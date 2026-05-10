import { localDb, type EmailInsert } from "@/db/client";
import type { EmailAICategory, SplitRule } from "@/db/schema";
import { getCurrentUserId } from "@/db/user";
import { gatekeeperQueryKeys } from "@/features/email/gatekeeper/query-keys";
import { emailQueryKeys } from "@/features/email/mail/query-keys";
import { accountQueryKeys } from "@/features/settings/query-keys";
import { accountsQueryOptions } from "@/hooks/use-mailboxes";
import { queryClient } from "@/lib/query-client";
import { AsyncQueuer, asyncQueue } from "@tanstack/pacer/async-queuer";
import { Throttler } from "@tanstack/pacer/throttler";
import type {
  CalendarInvitePreview,
  ContactSuggestion,
  DraftItem,
  EmailDetailItem,
  EmailListItem,
  EmailListPage,
  EmailThreadItem,
  InboxSearchScope,
  InboxSearchSuggestionsResponse,
  InboxUnreadCount,
  ViewUnreadCounts,
} from "./types";
import { prepareEmailHtml } from "./utils/prepare-email-html";

const VIEW_PAGE_SIZE = 25;

const ACTIVE_USER_KEY = "active-user-id";
const GMAIL_SYNC_WAIT_MS = 0;
const GMAIL_SYNC_MAX_SIZE = 100;
const GMAIL_SYNC_DEFAULT_COOLDOWN_MS = 60_000;
const CLASSIFICATION_MAX_CONCURRENCY = 2;
const CLASSIFICATION_MAX_MESSAGES = 6;
const CLASSIFICATION_MAX_SUMMARY_TEXT = 1400;
const CLASSIFICATION_MAX_BODY_TEXT = 2500;
const CLASSIFICATION_REQUEST_MAX_RETRIES = 2;
const CLASSIFICATION_RETRYABLE_STATUS_CODES = new Set([
  408, 409, 425, 429, 500, 502, 503, 504,
]);
const CALENDAR_MIME_PREFIXES = [
  "text/calendar",
  "application/ics",
  "application/icalendar",
  "application/x-ical",
  "application/vnd.ms-outlook",
] as const;
const CALENDAR_BODY_MARKERS = [
  "begin:vcalendar",
  "begin:vevent",
  "method:request",
  "method:cancel",
  "method:reply",
] as const;

const CLASSIFICATION_CATEGORIES = [
  "action_required",
  "invoice",
  "notification",
  "newsletter",
  "fyi",
  "unknown",
] as const;

type ClassificationCategory = (typeof CLASSIFICATION_CATEGORIES)[number];
const CLASSIFICATION_CATEGORY_SET = new Set<string>(CLASSIFICATION_CATEGORIES);

const CLASSIFICATION_MIN_CONFIDENCE = 0.8;

type PulledAttachment = {
  attachmentId: string;
  filename: string | null;
  mimeType: string | null;
  size: number | null;
  contentId: string | null;
  isInline: boolean;
  isImage: boolean;
};

type PulledInlineAttachment = {
  contentId: string;
  attachmentId: string;
  mimeType: string | null;
  filename: string | null;
};

type PulledEmail = {
  providerMessageId: string;
  threadId: string | null;
  messageId: string | null;
  fromAddr: string;
  fromName: string | null;
  toAddr: string | null;
  ccAddr: string | null;
  subject: string | null;
  snippet: string | null;
  bodyText: string | null;
  bodyHtml: string | null;
  date: number;
  direction: "sent" | "received";
  isRead: boolean;
  labelIds: string[];
  unsubscribeUrl: string | null;
  unsubscribeEmail: string | null;
  hasCalendar?: boolean;
  inlineAttachments?: PulledInlineAttachment[];
  attachments?: PulledAttachment[];
};

type GatekeeperTrustLevel = "trusted" | "blocked" | null;

type ClassifyThreadPayload = {
  mailboxId: number;
  thread: {
    subject: string | null;
    fromAddr: string;
    fromName: string | null;
    toAddr: string | null;
    snippet: string | null;
    bodyText: string | null;
    messages?: Array<{
      fromAddr: string;
      fromName: string | null;
      snippet: string | null;
      bodyText: string | null;
      date: number | null;
    }>;
  };
};

type ThreadClassificationResult = {
  category: ClassificationCategory;
  confidence: number;
  reason: string;
  summary: string;
  draftReply: string;
};

type ThreadClassificationTask = {
  userId: string;
  mailboxId: number;
  threadId: string | null;
  representativeProviderMessageId: string;
  classificationKey: string;
  payload: ClassifyThreadPayload;
};

export type ViewPage = EmailListPage;

const classificationQueuedKeys = new Set<string>();

const EMAIL_QUERY_INVALIDATION_THROTTLE_MS = 100;
let needsEmailQueryInvalidation = false;
const emailQueryInvalidationThrottler = new Throttler(
  () => {
    if (!needsEmailQueryInvalidation) return;
    needsEmailQueryInvalidation = false;
    void queryClient.invalidateQueries({ queryKey: emailQueryKeys.all() });
  },
  {
    wait: EMAIL_QUERY_INVALIDATION_THROTTLE_MS,
    leading: false,
    trailing: true,
  },
);

function invalidateInboxQueriesThrottled(): void {
  needsEmailQueryInvalidation = true;
  emailQueryInvalidationThrottler.maybeExecute();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function computeClassificationRetryDelayMs(attempt: number): number {
  const baseDelayMs = 700;
  const jitterMs = Math.floor(Math.random() * 500);
  return baseDelayMs * 2 ** attempt + jitterMs;
}

function clampText(
  value: string | null | undefined,
  max: number,
): string | null {
  if (!value) return null;
  const normalized = value.trim();
  if (!normalized) return null;
  return normalized.length <= max ? normalized : normalized.slice(0, max);
}

function hasCalendarMime(value: string | null | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return CALENDAR_MIME_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

function hasCalendarFilename(value: string | null | undefined): boolean {
  if (!value) return false;
  return value.trim().toLowerCase().endsWith(".ics");
}

function hasCalendarBodySignal(value: string | null | undefined): boolean {
  if (!value) return false;
  const normalized = value.toLowerCase();
  return CALENDAR_BODY_MARKERS.some((marker) => normalized.includes(marker));
}

function inferHasCalendar(email: PulledEmail): boolean {
  if (email.hasCalendar === true) return true;
  if (
    email.attachments?.some(
      (attachment) =>
        hasCalendarMime(attachment.mimeType) ||
        hasCalendarFilename(attachment.filename),
    )
  ) {
    return true;
  }
  return (
    hasCalendarBodySignal(email.bodyText) ||
    hasCalendarBodySignal(email.bodyHtml)
  );
}

function normalizeSender(fromAddr: string | null | undefined): string | null {
  if (!fromAddr) return null;
  const normalized = fromAddr.trim().toLowerCase();
  if (!normalized) return null;
  const bracketMatch = normalized.match(/<([^>]+)>/);
  const candidate = bracketMatch?.[1]?.trim() ?? normalized;
  const emailMatch = candidate.match(/[^\s<>()"'`,;:]+@[^\s<>()"'`,;:]+/);
  if (!emailMatch) return null;
  return emailMatch[0].toLowerCase();
}

function gatekeeperActivatedAtKey(mailboxId: number): string {
  return `gatekeeperActivatedAt:${mailboxId}`;
}

async function resolveGatekeeperActivatedAt(
  mailboxId: number,
): Promise<number> {
  const key = gatekeeperActivatedAtKey(mailboxId);
  const raw = await localDb.getMeta(key);
  const parsed = raw ? Number(raw) : NaN;
  if (Number.isFinite(parsed) && parsed > 0) return parsed;

  const now = Date.now();
  await localDb.setMeta(key, String(now));
  return now;
}

async function resolveGatekeeperTrust(
  pulled: PulledEmail[],
  mailboxId: number,
  userId: string,
  gatekeeperActivatedAt: number,
): Promise<Map<string, GatekeeperTrustLevel>> {
  const receivedInboxSenders = Array.from(
    new Set(
      pulled
        .filter(
          (email) =>
            email.direction === "received" && email.labelIds.includes("INBOX"),
        )
        .map((email) => normalizeSender(email.fromAddr))
        .filter((value): value is string => Boolean(value)),
    ),
  );

  if (receivedInboxSenders.length === 0) return new Map();

  const map = new Map<string, GatekeeperTrustLevel>();
  let serverResolveFailed = false;

  try {
    const response = await fetch("/api/inbox/gatekeeper/resolve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mailboxId,
        senders: receivedInboxSenders,
      }),
    });

    const payload = (await response.json().catch(() => null)) as {
      data?: {
        trust?: Array<{
          sender: string;
          trustLevel: GatekeeperTrustLevel;
        }>;
      };
    } | null;

    const trust = payload?.data?.trust;
    if (!response.ok || !Array.isArray(trust)) {
      serverResolveFailed = true;
    } else {
      const serverResolved = new Map(
        trust
          .map(
            (entry) =>
              [normalizeSender(entry.sender), entry.trustLevel] as const,
          )
          .filter(
            (entry): entry is [string, GatekeeperTrustLevel] =>
              typeof entry[0] === "string",
          ),
      );
      for (const [sender, trustLevel] of serverResolved) {
        if (trustLevel !== null) map.set(sender, trustLevel);
      }
    }
  } catch {
    serverResolveFailed = true;
  }

  try {
    const knownSenders = await localDb.getKnownSenders({
      userId,
      mailboxId,
      gatekeeperActivatedAt,
      senders: receivedInboxSenders,
    });
    for (const sender of knownSenders) {
      if (!map.has(sender)) {
        map.set(sender, "trusted");
      }
    }
  } catch {
    // Ignore fallback errors.
  }

  if (serverResolveFailed) {
    for (const sender of receivedInboxSenders) {
      if (!map.has(sender)) {
        map.set(sender, "trusted");
      }
    }
  }

  return map;
}

function buildClassificationTasks(
  pulled: PulledEmail[],
  userId: string,
  mailboxId: number,
): ThreadClassificationTask[] {
  const groups = new Map<string, PulledEmail[]>();
  for (const email of pulled) {
    const key = email.threadId ?? `pm:${email.providerMessageId}`;
    const bucket = groups.get(key);
    if (bucket) bucket.push(email);
    else groups.set(key, [email]);
  }

  const tasks: ThreadClassificationTask[] = [];
  for (const [groupKey, emails] of groups) {
    const sorted = [...emails].sort((left, right) => right.date - left.date);
    const representative = sorted[0];
    if (!representative) continue;
    if (representative.direction !== "received") continue;

    const messages = sorted
      .slice(0, CLASSIFICATION_MAX_MESSAGES)
      .map((email) => ({
        fromAddr: email.fromAddr,
        fromName: email.fromName ?? null,
        snippet: clampText(email.snippet, CLASSIFICATION_MAX_SUMMARY_TEXT),
        bodyText: clampText(email.bodyText, CLASSIFICATION_MAX_BODY_TEXT),
        date: Number.isFinite(email.date) ? email.date : null,
      }));

    tasks.push({
      userId,
      mailboxId,
      threadId: representative.threadId,
      representativeProviderMessageId: representative.providerMessageId,
      classificationKey: `${mailboxId}:${groupKey}:${representative.providerMessageId}`,
      payload: {
        mailboxId,
        thread: {
          subject: representative.subject ?? null,
          fromAddr: representative.fromAddr,
          fromName: representative.fromName ?? null,
          toAddr: representative.toAddr ?? null,
          snippet: clampText(
            representative.snippet,
            CLASSIFICATION_MAX_SUMMARY_TEXT,
          ),
          bodyText: clampText(
            representative.bodyText,
            CLASSIFICATION_MAX_BODY_TEXT,
          ),
          messages,
        },
      },
    });
  }

  return tasks;
}

function parseClassificationResponse(
  payload: unknown,
): ThreadClassificationResult | null {
  if (typeof payload !== "object" || payload === null) return null;
  const data = Reflect.get(payload, "data");
  if (typeof data !== "object" || data === null) return null;

  const categoryRaw = Reflect.get(data, "category");
  const confidenceRaw = Reflect.get(data, "confidence");
  const reasonRaw = Reflect.get(data, "reason");
  const summaryRaw = Reflect.get(data, "summary");
  const draftReplyRaw = Reflect.get(data, "draftReply");

  if (
    typeof categoryRaw !== "string" ||
    !CLASSIFICATION_CATEGORY_SET.has(categoryRaw)
  ) {
    return null;
  }
  if (typeof confidenceRaw !== "number" || !Number.isFinite(confidenceRaw)) {
    return null;
  }
  if (typeof reasonRaw !== "string" || typeof summaryRaw !== "string") {
    return null;
  }
  if (typeof draftReplyRaw !== "string") {
    return null;
  }

  const clampedConfidence = Math.max(0, Math.min(1, confidenceRaw));
  return {
    category: categoryRaw as ClassificationCategory,
    confidence: clampedConfidence,
    reason: reasonRaw,
    summary: summaryRaw,
    draftReply: draftReplyRaw,
  };
}

async function requestThreadClassification(
  payload: ClassifyThreadPayload,
): Promise<ThreadClassificationResult | null> {
  for (
    let attempt = 0;
    attempt <= CLASSIFICATION_REQUEST_MAX_RETRIES;
    attempt++
  ) {
    try {
      const response = await fetch("/api/ai/classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const canRetry =
          attempt < CLASSIFICATION_REQUEST_MAX_RETRIES &&
          CLASSIFICATION_RETRYABLE_STATUS_CODES.has(response.status);
        if (canRetry) {
          await sleep(computeClassificationRetryDelayMs(attempt));
          continue;
        }
        return null;
      }

      const json = await response.json().catch(() => null);
      const parsed = parseClassificationResponse(json);
      if (parsed) return parsed;

      if (attempt < CLASSIFICATION_REQUEST_MAX_RETRIES) {
        await sleep(computeClassificationRetryDelayMs(attempt));
        continue;
      }
      return null;
    } catch {
      if (attempt < CLASSIFICATION_REQUEST_MAX_RETRIES) {
        await sleep(computeClassificationRetryDelayMs(attempt));
        continue;
      }
      return null;
    }
  }

  return null;
}

async function processThreadClassificationTask(
  task: ThreadClassificationTask,
): Promise<void> {
  try {
    const isFresh = await localDb.isThreadClassificationFresh({
      userId: task.userId,
      mailboxId: task.mailboxId,
      threadId: task.threadId,
      representativeProviderMessageId: task.representativeProviderMessageId,
      classificationKey: task.classificationKey,
    });
    if (isFresh) return;

    const classified = await requestThreadClassification(task.payload);
    if (!classified) return;

    const gatedCategory: EmailAICategory =
      classified.confidence >= CLASSIFICATION_MIN_CONFIDENCE
        ? (classified.category as EmailAICategory)
        : "unknown";
    const gatedDraftReply =
      gatedCategory === "action_required" ? classified.draftReply : "";

    await localDb.updateThreadClassification({
      userId: task.userId,
      mailboxId: task.mailboxId,
      threadId: task.threadId,
      representativeProviderMessageId: task.representativeProviderMessageId,
      classificationKey: task.classificationKey,
      category: gatedCategory,
      confidence: classified.confidence,
      reason: classified.reason,
      summary: classified.summary,
      draftReply: gatedDraftReply,
      classifiedAt: Date.now(),
    });

    invalidateInboxQueriesThrottled();
  } catch {
    /* classification is best-effort */
  }
}

const enqueueThreadClassification = asyncQueue<ThreadClassificationTask>(
  async (task) => {
    try {
      await processThreadClassificationTask(task);
    } finally {
      classificationQueuedKeys.delete(task.classificationKey);
    }
  },
  {
    concurrency: CLASSIFICATION_MAX_CONCURRENCY,
    throwOnError: false,
    onError: () => {},
  },
);

function isMailboxClassificationEnabled(mailboxId: number): boolean {
  const cached = queryClient.getQueryData(accountsQueryOptions.queryKey);
  const account = cached?.accounts.find((a) => a.mailboxId === mailboxId);
  return account?.aiClassificationEnabled ?? false;
}

function enqueueClassificationTasks(
  pulled: PulledEmail[],
  userId: string,
  mailboxId: number,
): void {
  if (!isMailboxClassificationEnabled(mailboxId)) return;
  const tasks = buildClassificationTasks(pulled, userId, mailboxId);
  if (tasks.length === 0) return;

  for (const task of tasks) {
    if (classificationQueuedKeys.has(task.classificationKey)) continue;
    classificationQueuedKeys.add(task.classificationKey);
    enqueueThreadClassification(task);
  }
}

function pulledToRow(
  email: PulledEmail,
  userId: string,
  mailboxId: number,
  senderTrust: GatekeeperTrustLevel,
  gatekeeperActivatedAt: number,
): EmailInsert {
  const labels = new Set(email.labelIds);
  if (senderTrust === "blocked") {
    labels.delete("INBOX");
    labels.delete("UNREAD");
    labels.add("TRASH");
  }
  const labelIds = Array.from(labels);
  const isGatekept =
    senderTrust === null &&
    email.direction === "received" &&
    labels.has("INBOX") &&
    email.date >= gatekeeperActivatedAt;

  return {
    userId,
    mailboxId,
    providerMessageId: email.providerMessageId,
    fromAddr: email.fromAddr,
    fromName: email.fromName,
    toAddr: email.toAddr,
    ccAddr: email.ccAddr,
    subject: email.subject,
    snippet: email.snippet,
    threadId: email.threadId,
    date: email.date,
    direction: email.direction,
    isRead: email.isRead,
    labelIds: JSON.stringify(labelIds),
    hasInbox: labelIds.includes("INBOX"),
    hasSent: labelIds.includes("SENT"),
    hasTrash: labelIds.includes("TRASH"),
    hasSpam: labelIds.includes("SPAM"),
    hasStarred: labelIds.includes("STARRED"),
    unsubscribeUrl: email.unsubscribeUrl,
    unsubscribeEmail: email.unsubscribeEmail,
    snoozedUntil: null,
    bodyText: email.bodyText,
    bodyHtml: email.bodyHtml
      ? prepareEmailHtml(
          email.bodyHtml,
          email.inlineAttachments && email.inlineAttachments.length > 0
            ? {
                providerMessageId: email.providerMessageId,
                mailboxId,
                attachments: email.inlineAttachments,
              }
            : null,
        )
      : null,
    inlineAttachments:
      email.inlineAttachments && email.inlineAttachments.length > 0
        ? JSON.stringify(email.inlineAttachments)
        : null,
    attachments:
      email.attachments && email.attachments.length > 0
        ? JSON.stringify(email.attachments)
        : null,
    hasCalendar: inferHasCalendar(email),
    isGatekept,
    aiCategory: null,
    aiConfidence: null,
    aiReason: null,
    aiSummary: null,
    aiDraftReply: null,
    aiClassifiedAt: null,
    aiClassificationKey: null,
    aiSplitIds: null,
    createdAt: email.date,
  };
}

async function alignActiveUser(userId: string): Promise<void> {
  await localDb.ensureReady();
  const active = await localDb.getMeta(ACTIVE_USER_KEY);
  if (active && active !== userId) {
    await localDb.clear();
  }
  if (active !== userId) {
    await localDb.setMeta(ACTIVE_USER_KEY, userId);
  }
}

async function persistEmails(
  pulled: PulledEmail[],
  userId: string,
  mailboxId: number,
): Promise<EmailListItem[]> {
  if (pulled.length === 0) return [];
  const gatekeeperActivatedAt = await resolveGatekeeperActivatedAt(mailboxId);
  const trustBySender = await resolveGatekeeperTrust(
    pulled,
    mailboxId,
    userId,
    gatekeeperActivatedAt,
  );
  const rows = pulled.map((e) =>
    pulledToRow(
      e,
      userId,
      mailboxId,
      trustBySender.get(normalizeSender(e.fromAddr) ?? "") ?? null,
      gatekeeperActivatedAt,
    ),
  );
  await localDb.insertEmails(rows);
  void queryClient.invalidateQueries({
    queryKey: gatekeeperQueryKeys.pending(mailboxId),
  });
  const providerIds = pulled.map((e) => e.providerMessageId);
  const hydrated = await localDb.getEmailsByProviderMessageIds(
    userId,
    providerIds,
  );
  const byProviderId = new Map(hydrated.map((r) => [r.providerMessageId, r]));
  enqueueClassificationTasks(pulled, userId, mailboxId);
  return providerIds
    .map((id) => byProviderId.get(id))
    .filter((e): e is NonNullable<typeof e> => e !== undefined);
}

type LocalCursor = { type: "local"; beforeDate: number; beforeId: number };
type LegacyLocalCursor = { type: "local"; beforeMs: number };
type RemoteCursor = {
  type: "remote";
  token?: string;
  beforeMs?: number;
};
type DecodedCursor = LocalCursor | LegacyLocalCursor | RemoteCursor;

export type ViewSyncMeta = {
  lastFetchedAt: number | null;
  lastError: string | null;
};

const EMPTY_VIEW_SYNC_META: ViewSyncMeta = {
  lastFetchedAt: null,
  lastError: null,
};

function encodeViewCursor(cursor: DecodedCursor): string {
  return btoa(JSON.stringify(cursor));
}

function decodeViewCursor(cursor: string | undefined): DecodedCursor | null {
  if (!cursor) return null;
  try {
    return JSON.parse(atob(cursor)) as DecodedCursor;
  } catch {
    return null;
  }
}

const inFlightRequests = new Map<string, Promise<unknown>>();

function dedup<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = inFlightRequests.get(key) as Promise<T> | undefined;
  if (existing) return existing;
  const promise = fn().finally(() => inFlightRequests.delete(key));
  inFlightRequests.set(key, promise);
  return promise;
}

function refreshKey(mailboxId: number, view: string): string {
  return `view-refresh:${mailboxId}:${view}`;
}

const refreshInFlight = new Map<string, Promise<void>>();
const refreshLastRunAt = new Map<string, number>();
const VIEW_BACKGROUND_REFRESH_COOLDOWN_MS = 10_000;

function viewSyncMetaKey(mailboxId: number, view: string): string {
  return `viewSyncMeta:${mailboxId}:${view}`;
}

function parseViewSyncMeta(raw: string | null): ViewSyncMeta {
  if (!raw) return EMPTY_VIEW_SYNC_META;
  try {
    const parsed = JSON.parse(raw) as Partial<ViewSyncMeta>;
    return {
      lastFetchedAt:
        typeof parsed.lastFetchedAt === "number" ? parsed.lastFetchedAt : null,
      lastError: typeof parsed.lastError === "string" ? parsed.lastError : null,
    };
  } catch {
    return EMPTY_VIEW_SYNC_META;
  }
}

async function setViewSyncMeta(
  mailboxId: number,
  view: string,
  meta: ViewSyncMeta,
): Promise<void> {
  await localDb.setMeta(viewSyncMetaKey(mailboxId, view), JSON.stringify(meta));
  void queryClient.invalidateQueries({
    queryKey: emailQueryKeys.viewSyncMeta(view, mailboxId),
  });
}

function searchRefreshKey(params: InboxSearchScope): string {
  return [
    "search-refresh",
    params.mailboxId ?? "none",
    params.view ?? "all",
    params.includeJunk ? "junk" : "nojunk",
    params.q.trim().replace(/\s+/g, " ").toLowerCase(),
  ].join(":");
}

function contactSuggestionRefreshKey(q: string, mailboxId: number): string {
  return `contact-refresh:${mailboxId}:${q.trim().toLowerCase()}`;
}

function buildContactSuggestionSearchQuery(q: string): string {
  const cleaned = q.trim().replace(/["\\]/g, " ").replace(/\s+/g, " ");
  if (!cleaned) return q;
  return `${cleaned} OR from:${cleaned} OR to:${cleaned} OR cc:${cleaned}`;
}

function mergeContactSuggestions(
  primary: ContactSuggestion[],
  secondary: ContactSuggestion[],
  limit: number,
): ContactSuggestion[] {
  const byEmail = new Map<string, ContactSuggestion>();
  for (const item of [...primary, ...secondary]) {
    const key = item.email.trim().toLowerCase();
    if (!key || byEmail.has(key)) continue;
    byEmail.set(key, item);
  }
  return Array.from(byEmail.values()).slice(0, limit);
}

export async function fetchViewSyncMeta(params: {
  mailboxId: number;
  view: string;
}): Promise<ViewSyncMeta> {
  const userId = await getCurrentUserId();
  if (!userId) return EMPTY_VIEW_SYNC_META;

  await alignActiveUser(userId);
  return parseViewSyncMeta(
    await localDb.getMeta(viewSyncMetaKey(params.mailboxId, params.view)),
  );
}

async function refreshViewFromServer(
  userId: string,
  mailboxId: number,
  view: string,
  reason: GmailSyncReason = "background",
): Promise<void> {
  const key = refreshKey(mailboxId, view);
  const existing = refreshInFlight.get(key);
  if (existing && reason !== "active-view") return existing;

  const lastRunAt = refreshLastRunAt.get(key) ?? 0;
  // A successful background refresh invalidates this same list query. Without a
  // short per-view cooldown, that invalidation immediately schedules another
  // background refresh from the first-page fetch and loops forever.
  if (
    reason !== "active-view" &&
    Date.now() - lastRunAt < VIEW_BACKGROUND_REFRESH_COOLDOWN_MS
  ) {
    return;
  }

  const task = (async () => {
    try {
      await enqueueViewSyncPage({
        userId,
        mailboxId,
        view,
        cursor: { type: "remote" },
        reason,
        invalidateOnSuccess: true,
      });
    } catch {
      /* background refresh failure is non-fatal */
    }
  })().finally(() => {
    refreshLastRunAt.set(key, Date.now());
    if (refreshInFlight.get(key) === task) refreshInFlight.delete(key);
  });

  refreshInFlight.set(key, task);
  return task;
}

class GmailViewFetchError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly retryAfterMs: number | null,
  ) {
    super(message);
    this.name = "GmailViewFetchError";
  }
}

async function fetchServerPage(
  userId: string,
  mailboxId: number,
  view: string,
  cursor: RemoteCursor,
  filters?: MailListFilters,
): Promise<ViewPage> {
  const res = await fetch("/api/inbox/view/page", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mailboxId,
      view,
      cursor: cursor.token || undefined,
      beforeMs: cursor.beforeMs,
      limit: VIEW_PAGE_SIZE,
      filters,
    }),
  });
  if (!res.ok) {
    const errorBody = (await res
      .clone()
      .json()
      .catch(() => null)) as { error?: string } | null;
    const retryAfter = res.headers.get("retry-after");
    const retryAfterSeconds = retryAfter ? Number(retryAfter) : NaN;
    const retryAfterMs =
      Number.isFinite(retryAfterSeconds) && retryAfterSeconds >= 0
        ? Math.floor(retryAfterSeconds * 1000)
        : null;
    const reconnectRequired =
      res.status === 401 && errorBody?.error === "google_reconnect_required";
    const lastError = reconnectRequired
      ? "reconnect_required"
      : res.status === 429
        ? "gmail_rate_limited"
        : `fetch_failed_${res.status}`;
    const previousMeta = parseViewSyncMeta(
      await localDb.getMeta(viewSyncMetaKey(mailboxId, view)),
    );
    await setViewSyncMeta(mailboxId, view, {
      lastFetchedAt: previousMeta.lastFetchedAt,
      lastError,
    });
    if (reconnectRequired) {
      void queryClient.invalidateQueries({
        queryKey: accountsQueryOptions.queryKey,
      });
    }
    throw new GmailViewFetchError(
      `View fetch failed: ${res.status}`,
      res.status,
      retryAfterMs,
    );
  }

  const body = (await res.json()) as {
    emails: PulledEmail[];
    cursor: string | null;
  };
  const emails = await persistEmails(body.emails, userId, mailboxId);
  await setViewSyncMeta(mailboxId, view, {
    lastFetchedAt: Date.now(),
    lastError: null,
  });
  const nextCursor = body.cursor
    ? encodeViewCursor({
        type: "remote",
        token: body.cursor,
        beforeMs: cursor.beforeMs,
      })
    : null;
  return { emails, cursor: nextCursor };
}

type GmailSyncReason = "active-view" | "active-page" | "background" | "preload";

type GmailViewSyncTask = {
  key: string;
  userId: string;
  mailboxId: number;
  view: string;
  cursor: RemoteCursor;
  reason: GmailSyncReason;
  priority: number;
  invalidateOnSuccess: boolean;
  filters?: MailListFilters;
  resolve: (page: ViewPage) => void;
  reject: (error: unknown) => void;
};

const gmailViewSyncInFlight = new Map<string, Promise<ViewPage>>();

function getGmailViewSyncPriority(
  view: string,
  reason: GmailSyncReason,
): number {
  if (reason === "active-page") return 1_100;
  if (reason === "active-view") return 1_000;
  if (view === "inbox") return 700;
  if (view === "sent" || view === "starred" || view === "important") return 400;
  if (view === "archived") return 250;
  if (view === "spam" || view === "trash") return 100;
  return reason === "preload" ? 10 : 200;
}

function getGmailViewSyncKey(params: {
  userId: string;
  mailboxId: number;
  view: string;
  cursor: RemoteCursor;
  filters?: MailListFilters;
}): string {
  return [
    params.userId,
    params.mailboxId,
    params.view,
    params.cursor.token ?? "first",
    params.cursor.beforeMs ?? "none",
    params.filters?.unread ? "u" : "",
    params.filters?.starred ? "s" : "",
    params.filters?.hasAttachment ? "a" : "",
  ].join(":");
}

function getGmailCooldownMs(error: unknown): number | null {
  if (!(error instanceof GmailViewFetchError)) return null;
  if (error.status !== 429 && error.status !== 503) return null;
  return error.retryAfterMs ?? GMAIL_SYNC_DEFAULT_COOLDOWN_MS;
}

const gmailViewSyncQueue = new AsyncQueuer<GmailViewSyncTask>(
  async (task) => {
    try {
      const page = await fetchServerPage(
        task.userId,
        task.mailboxId,
        task.view,
        task.cursor,
        task.filters,
      );
      task.resolve(page);
      if (task.invalidateOnSuccess) {
        void queryClient.invalidateQueries({
          queryKey: emailQueryKeys.list(task.view, task.mailboxId),
        });
      }
    } catch (error) {
      task.reject(error);
      throw error;
    } finally {
      gmailViewSyncInFlight.delete(task.key);
    }
  },
  {
    key: "gmail-view-sync",
    concurrency: 1,
    wait: GMAIL_SYNC_WAIT_MS,
    maxSize: GMAIL_SYNC_MAX_SIZE,
    getPriority: (task) => task.priority,
    throwOnError: false,
    onError: (error, _task, queuer) => {
      const cooldownMs = getGmailCooldownMs(error);
      if (cooldownMs == null) return;
      queuer.stop();
      globalThis.setTimeout(() => queuer.start(), cooldownMs);
    },
  },
);

function enqueueViewSyncPage(params: {
  userId: string;
  mailboxId: number;
  view: string;
  cursor: RemoteCursor;
  reason: GmailSyncReason;
  invalidateOnSuccess?: boolean;
  filters?: MailListFilters;
}): Promise<ViewPage> {
  const key = getGmailViewSyncKey(params);
  const existing = gmailViewSyncInFlight.get(key);
  if (existing) return existing;

  const promise = new Promise<ViewPage>((resolve, reject) => {
    const queued = gmailViewSyncQueue.addItem({
      ...params,
      key,
      priority: getGmailViewSyncPriority(params.view, params.reason),
      invalidateOnSuccess: params.invalidateOnSuccess ?? false,
      resolve,
      reject,
    });
    if (!queued) reject(new Error("Gmail sync queue is full."));
  });
  gmailViewSyncInFlight.set(key, promise);
  return promise;
}

export async function enqueueActiveViewSync(params: {
  mailboxId: number;
  view: string;
}): Promise<void> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return;
    await alignActiveUser(userId);
    await refreshViewFromServer(
      userId,
      params.mailboxId,
      params.view,
      "active-view",
    );
  } catch {
    /* Active sync is best-effort; the list can render cached local data. */
  }
}

export type MailListFilters = {
  unread?: boolean;
  starred?: boolean;
  hasAttachment?: boolean;
};

export async function fetchViewPage(params: {
  mailboxId: number;
  view: string;
  cursor?: string;
  splitRule?: SplitRule | null;
  filters?: MailListFilters;
}): Promise<ViewPage> {
  const userId = await getCurrentUserId();
  if (!userId) return { emails: [], cursor: null };

  await alignActiveUser(userId);

  const splitRule = params.splitRule ?? null;
  const splitScoped = splitRule !== null;
  const filters = params.filters;
  const decoded = decodeViewCursor(params.cursor);

  if (decoded?.type === "remote" && !splitScoped) {
    return enqueueViewSyncPage({
      userId,
      mailboxId: params.mailboxId,
      view: params.view,
      cursor: decoded,
      reason: "active-page",
      filters,
    });
  }

  const localCursor =
    decoded?.type === "local"
      ? "beforeDate" in decoded
        ? {
            date: decoded.beforeDate,
            id: decoded.beforeId,
          }
        : typeof decoded.beforeMs === "number"
          ? { date: decoded.beforeMs }
          : undefined
      : undefined;
  const beforeMs = localCursor?.date;
  const local = await localDb.getEmails({
    userId,
    mailboxId: params.mailboxId,
    view: params.view,
    limit: VIEW_PAGE_SIZE,
    cursor: localCursor,
    splitRule,
    isRead: filters?.unread ? "false" : undefined,
    starred: filters?.starred,
    hasAttachment: filters?.hasAttachment,
  });

  if (local.data.length === 0) {
    if (splitScoped) {
      await enqueueViewSyncPage({
        userId,
        mailboxId: params.mailboxId,
        view: params.view,
        cursor: { type: "remote", beforeMs },
        reason: "active-page",
        filters,
      });
      const seeded = await localDb.getEmails({
        userId,
        mailboxId: params.mailboxId,
        view: params.view,
        limit: VIEW_PAGE_SIZE,
        cursor: localCursor,
        splitRule,
        isRead: filters?.unread ? "false" : undefined,
        starred: filters?.starred,
        hasAttachment: filters?.hasAttachment,
      });
      if (seeded.pagination.hasMore && seeded.pagination.cursor) {
        return {
          emails: seeded.data,
          cursor: encodeViewCursor({
            type: "local",
            beforeDate: seeded.pagination.cursor.date,
            beforeId: seeded.pagination.cursor.id,
          }),
        };
      }
      return { emails: seeded.data, cursor: null };
    }
    return enqueueViewSyncPage({
      userId,
      mailboxId: params.mailboxId,
      view: params.view,
      cursor: { type: "remote", beforeMs },
      reason: "active-view",
      filters,
    });
  }

  const lastDate =
    local.pagination.cursor?.date ?? local.data[local.data.length - 1]?.date;

  if (local.pagination.hasMore && local.pagination.cursor) {
    return {
      emails: local.data,
      cursor: encodeViewCursor({
        type: "local",
        beforeDate: local.pagination.cursor.date,
        beforeId: local.pagination.cursor.id,
      }),
    };
  }

  if (splitScoped) {
    return { emails: local.data, cursor: null };
  }

  return {
    emails: local.data,
    cursor: encodeViewCursor({
      type: "remote",
      beforeMs: lastDate ?? undefined,
    }),
  };
}

export async function fetchLocalViewPage(params: {
  mailboxId: number;
  view: string;
  cursor?: string;
  limit?: number;
  splitRule?: SplitRule | null;
}): Promise<ViewPage> {
  const userId = await getCurrentUserId();
  if (!userId) return { emails: [], cursor: null };

  await alignActiveUser(userId);

  const decoded = decodeViewCursor(params.cursor);
  const localCursor =
    decoded?.type === "local"
      ? "beforeDate" in decoded
        ? {
            date: decoded.beforeDate,
            id: decoded.beforeId,
          }
        : typeof decoded.beforeMs === "number"
          ? { date: decoded.beforeMs }
          : undefined
      : undefined;

  const local = await localDb.getEmails({
    userId,
    mailboxId: params.mailboxId,
    view: params.view,
    limit: params.limit ?? VIEW_PAGE_SIZE,
    cursor: localCursor,
    splitRule: params.splitRule ?? null,
  });

  if (local.pagination.hasMore && local.pagination.cursor) {
    return {
      emails: local.data,
      cursor: encodeViewCursor({
        type: "local",
        beforeDate: local.pagination.cursor.date,
        beforeId: local.pagination.cursor.id,
      }),
    };
  }

  return { emails: local.data, cursor: null };
}

export async function fetchAllLocalViewEmails(params: {
  mailboxId: number;
  view: string;
  pageSize?: number;
}): Promise<ViewPage> {
  const emails: EmailListItem[] = [];
  let cursor: string | undefined;
  const pageSize = params.pageSize ?? VIEW_PAGE_SIZE;

  do {
    const page = await fetchLocalViewPage({
      mailboxId: params.mailboxId,
      view: params.view,
      cursor,
      limit: pageSize,
    });
    emails.push(...page.emails);
    cursor = page.cursor ?? undefined;
  } while (cursor);

  return { emails, cursor: null };
}

const SEARCH_PAGE_SIZE = 30;
const searchRemoteRefreshed = new Set<string>();

export async function fetchSearchEmails(
  params: InboxSearchScope & { cursor?: string },
): Promise<ViewPage> {
  const userId = await getCurrentUserId();
  if (!userId || !params.mailboxId) return { emails: [], cursor: null };

  await alignActiveUser(userId);

  const normalizedQuery = params.q.trim().replace(/\s+/g, " ");
  if (!normalizedQuery) return { emails: [], cursor: null };

  const offset = params.cursor ? Number(params.cursor) || 0 : 0;
  const refreshKey = searchRefreshKey({ ...params, q: normalizedQuery });

  if (offset === 0 && !searchRemoteRefreshed.has(refreshKey)) {
    searchRemoteRefreshed.add(refreshKey);
    try {
      const res = await fetch("/api/inbox/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mailboxId: params.mailboxId,
          q: normalizedQuery,
          includeJunk: params.includeJunk ?? false,
        }),
      });
      if (res.ok) {
        const body = (await res.json()) as { emails: PulledEmail[] };
        await persistEmails(body.emails, userId, params.mailboxId);
      }
    } catch {
      searchRemoteRefreshed.delete(refreshKey);
    }
  }

  const local = await localDb.searchEmails({
    userId,
    query: normalizedQuery,
    mailboxId: params.mailboxId,
    view: params.view,
    includeJunk: params.includeJunk ?? false,
    limit: SEARCH_PAGE_SIZE,
    offset,
  });

  const cursor = local.pagination.hasMore
    ? String(offset + SEARCH_PAGE_SIZE)
    : null;

  return { emails: local.data, cursor };
}

export async function fetchRemoteSearchEmails(
  params: InboxSearchScope & { cursor?: string },
): Promise<ViewPage> {
  const userId = await getCurrentUserId();
  if (!userId || !params.mailboxId) return { emails: [], cursor: null };

  await alignActiveUser(userId);

  const res = await fetch("/api/inbox/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mailboxId: params.mailboxId,
      q: params.q,
      pageToken: params.cursor,
      includeJunk: params.includeJunk ?? false,
    }),
  });
  if (!res.ok) throw new Error(`Search failed: ${res.status}`);

  const body = (await res.json()) as {
    emails: PulledEmail[];
    cursor: string | null;
  };
  const emails = await persistEmails(body.emails, userId, params.mailboxId);
  return { emails, cursor: body.cursor };
}

const threadHydrationInFlight = new Map<string, Promise<void>>();

export async function fetchRemoteEmailThread(params: {
  mailboxId: number;
  threadId: string;
}): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId || !params.mailboxId || !params.threadId) return;

  await alignActiveUser(userId);

  const key = `${params.mailboxId}:${params.threadId}`;
  const existing = threadHydrationInFlight.get(key);
  if (existing) return existing;

  const promise = (async () => {
    const res = await fetch("/api/inbox/emails/thread", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mailboxId: params.mailboxId,
        threadId: params.threadId,
      }),
    });
    if (!res.ok) {
      throw new Error(`Failed to load thread: ${res.status}`);
    }
    const body = (await res.json()) as { emails: PulledEmail[] };
    if (body.emails?.length) {
      await persistEmails(body.emails, userId, params.mailboxId);
      void queryClient.invalidateQueries({
        queryKey: emailQueryKeys.thread(params.threadId),
      });
    }
  })().finally(() => {
    threadHydrationInFlight.delete(key);
  });

  threadHydrationInFlight.set(key, promise);
  return promise;
}

export async function fetchEmailDetail(
  emailId: string,
  context?: { mailboxId?: number; view?: string },
): Promise<EmailDetailItem> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error("Not authenticated");

  const numericId = Number(emailId);
  const local = await localDb.getEmailDetail(userId, numericId);
  if (!local) throw new Error("Email not found in local database");

  if (local.bodyHtml || local.bodyText) return local;

  const mailboxId = context?.mailboxId ?? local.mailboxId ?? null;
  const threadId = local.threadId ?? null;
  if (!mailboxId || !threadId) return local;

  await fetchRemoteEmailThread({ mailboxId, threadId });
  const hydrated = await localDb.getEmailDetail(userId, numericId);
  return hydrated ?? local;
}

export async function fetchCalendarInvitePreview(params: {
  mailboxId: number;
  providerMessageId: string;
}): Promise<CalendarInvitePreview | null> {
  const response = await fetch("/api/inbox/calendar/preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mailboxId: params.mailboxId,
      providerMessageId: params.providerMessageId,
    }),
  });

  const payload = (await response.json().catch(() => null)) as {
    error?: string;
    data?: { invite?: CalendarInvitePreview | null };
  } | null;

  if (!response.ok) {
    throw new Error(payload?.error ?? "Failed to load calendar invite preview");
  }

  return payload?.data?.invite ?? null;
}

export async function fetchEmailThread(
  threadId: string,
): Promise<EmailThreadItem[]> {
  const userId = await getCurrentUserId();
  if (!userId) return [];
  return localDb.getEmailThread(userId, threadId);
}

export async function fetchContactSuggestions(
  q: string,
  limit = 8,
  mailboxId?: number,
): Promise<ContactSuggestion[]> {
  const userId = await getCurrentUserId();
  if (!userId) return [];
  const normalizedQuery = q.trim();
  const local = await localDb.getContactSuggestions(
    userId,
    normalizedQuery,
    mailboxId,
    limit,
  );
  if (!mailboxId || normalizedQuery.length < 2) return local;

  const remoteRefresh = dedup(
    contactSuggestionRefreshKey(normalizedQuery, mailboxId),
    async () => {
      const response = await fetch("/api/inbox/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mailboxId,
          q: buildContactSuggestionSearchQuery(normalizedQuery),
          includeJunk: true,
        }),
      });
      if (!response.ok) return;
      const body = (await response.json()) as { emails?: PulledEmail[] };
      if (body.emails?.length) {
        await persistEmails(body.emails, userId, mailboxId);
      }
    },
  ).catch(() => {});

  if (local.length >= limit) return local;

  await remoteRefresh;
  const refreshed = await localDb.getContactSuggestions(
    userId,
    normalizedQuery,
    mailboxId,
    limit,
  );
  return mergeContactSuggestions(local, refreshed, limit);
}

export async function fetchSearchSuggestions(
  params: InboxSearchScope,
): Promise<InboxSearchSuggestionsResponse> {
  const userId = await getCurrentUserId();
  if (!userId) return { filters: [], contacts: [], subjects: [] };
  return localDb.getSearchSuggestions({
    userId,
    query: params.q.trim().replace(/\s+/g, " "),
    mailboxId: params.mailboxId,
    view: params.view,
  });
}

export async function fetchDrafts(
  mailboxId: number | null,
): Promise<DraftItem[]> {
  const userId = await getCurrentUserId();
  if (!userId) return [];
  return localDb.getDrafts(userId, mailboxId ?? undefined);
}

export async function deleteDraft(id: number): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error("Not authenticated");
  await localDb.deleteDraft(id, userId);
}

export async function fetchInboxUnreadCount(
  mailboxId: number,
): Promise<InboxUnreadCount> {
  const params = new URLSearchParams({ mailboxId: String(mailboxId) });
  const response = await fetch(`/api/inbox/unread-count?${params.toString()}`);
  const result = (await response.json().catch(() => null)) as {
    data?: InboxUnreadCount;
    error?: string;
  } | null;

  if (!response.ok || !result?.data) {
    throw new Error(result?.error ?? "Failed to fetch inbox unread count");
  }

  return result.data;
}

export async function fetchViewUnreadCounts(
  mailboxId: number,
): Promise<ViewUnreadCounts> {
  const params = new URLSearchParams({ mailboxId: String(mailboxId) });
  const response = await fetch(`/api/inbox/view-counts?${params.toString()}`);
  const result = (await response.json().catch(() => null)) as {
    data?: ViewUnreadCounts;
    error?: string;
  } | null;

  if (!response.ok || !result?.data) {
    throw new Error(result?.error ?? "Failed to fetch view unread counts");
  }

  return result.data;
}

export function invalidateInboxQueries() {
  invalidateInboxQueriesThrottled();
}

const HARDCODED_PRELOAD_VIEWS: ReadonlyArray<string> = [
  "sent",
  "archived",
  "starred",
  "important",
];

export function preloadInactiveViews(
  mailboxId: number,
  extraViews: ReadonlyArray<string> = [],
): void {
  if (!mailboxId) return;

  void (async () => {
    const userId = await getCurrentUserId();
    if (!userId) return;
    await alignActiveUser(userId);

    const seen = new Set<string>();
    for (const view of [...HARDCODED_PRELOAD_VIEWS, ...extraViews]) {
      if (!view || seen.has(view)) continue;
      seen.add(view);
      void enqueueViewSyncPage({
        userId,
        mailboxId,
        view,
        cursor: { type: "remote" },
        reason: "preload",
      }).catch(() => {});
    }
  })();
}

const BODY_BACKFILL_BATCH_SIZE = 25;
const BODY_BACKFILL_CONCURRENCY = 3;

export function backfillMissingBodies(mailboxId: number): void {
  if (!mailboxId) return;

  void dedup(`body-backfill:${mailboxId}`, async () => {
    const userId = await getCurrentUserId();
    if (!userId) return;
    await alignActiveUser(userId);

    let lastBatchSig: string | null = null;
    while (true) {
      const batch = await localDb.getThreadsMissingBodies(
        userId,
        mailboxId,
        BODY_BACKFILL_BATCH_SIZE,
      );
      if (batch.length === 0) return;

      const sig = batch
        .map((t) => t.threadId)
        .sort()
        .join(",");
      if (sig === lastBatchSig) return;
      lastBatchSig = sig;

      for (let i = 0; i < batch.length; i += BODY_BACKFILL_CONCURRENCY) {
        const slice = batch.slice(i, i + BODY_BACKFILL_CONCURRENCY);
        await Promise.allSettled(
          slice.map((thread) =>
            fetchRemoteEmailThread({
              mailboxId: thread.mailboxId,
              threadId: thread.threadId,
            }),
          ),
        );
      }
    }
  });
}

type DeltaSyncResponse = {
  status: "ok" | "noop" | "stale";
  added: PulledEmail[];
  deleted: string[];
  labelChanges: Array<{
    providerMessageId: string;
    addedLabels: string[];
    removedLabels: string[];
  }>;
  historyId: string | null;
};

export async function runDeltaSync(
  mailboxId: number,
): Promise<DeltaSyncResponse | null> {
  if (!mailboxId) return null;

  return dedup(`delta-sync:${mailboxId}`, async () => {
    const userId = await getCurrentUserId();
    if (!userId) return null;
    await alignActiveUser(userId);

    const res = await fetch("/api/inbox/sync/delta", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mailboxId }),
    });
    if (!res.ok) {
      if (res.status === 401) {
        await queryClient.invalidateQueries({
          queryKey: accountQueryKeys.all(),
        });
      }
      return null;
    }
    const body = (await res.json()) as DeltaSyncResponse;

    let appliedAnything = false;

    if (body.added?.length) {
      await persistEmails(body.added, userId, mailboxId);
      appliedAnything = true;
    }

    if (body.deleted?.length) {
      await localDb.deleteEmailsByProviderMessageId(body.deleted);
      appliedAnything = true;
    }

    if (body.labelChanges?.length) {
      for (const change of body.labelChanges) {
        for (const labelId of change.removedLabels) {
          await localDb.removeLabelFromEmails(
            [change.providerMessageId],
            labelId,
          );
        }
        for (const labelId of change.addedLabels) {
          await localDb.addLabelToEmails([change.providerMessageId], labelId);
        }
      }
      appliedAnything = true;
    }

    if (appliedAnything) {
      void queryClient.invalidateQueries({ queryKey: emailQueryKeys.all() });
    }

    return body;
  });
}
