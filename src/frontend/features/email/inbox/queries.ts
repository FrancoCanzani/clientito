import { localDb, type EmailInsert } from "@/db/client";
import type { EmailAICategory } from "@/db/schema";
import { getCurrentUserId } from "@/db/user";
import { queryClient } from "@/lib/query-client";
import { queryKeys } from "@/lib/query-keys";
import { asyncQueue } from "@tanstack/pacer/async-queuer";
import type {
  ContactSuggestion,
  DraftItem,
  EmailDetailItem,
  EmailListItem,
  EmailListPage,
  EmailThreadItem,
  InboxSearchScope,
  InboxSearchSuggestionsResponse,
} from "./types";

export const VIEW_PAGE_SIZE = 100;

const ACTIVE_USER_KEY = "active-user-id";
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

type ClassifyThreadPayload = {
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function computeClassificationRetryDelayMs(attempt: number): number {
  const baseDelayMs = 700;
  const jitterMs = Math.floor(Math.random() * 500);
  return baseDelayMs * 2 ** attempt + jitterMs;
}

function clampText(value: string | null | undefined, max: number): string | null {
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
        thread: {
          subject: representative.subject ?? null,
          fromAddr: representative.fromAddr,
          fromName: representative.fromName ?? null,
          toAddr: representative.toAddr ?? null,
          snippet: clampText(representative.snippet, CLASSIFICATION_MAX_SUMMARY_TEXT),
          bodyText: clampText(representative.bodyText, CLASSIFICATION_MAX_BODY_TEXT),
          messages,
        },
      },
    });
  }

  return tasks;
}

function parseClassificationResponse(payload: unknown): ThreadClassificationResult | null {
  if (typeof payload !== "object" || payload === null) return null;
  const data = Reflect.get(payload, "data");
  if (typeof data !== "object" || data === null) return null;

  const categoryRaw = Reflect.get(data, "category");
  const confidenceRaw = Reflect.get(data, "confidence");
  const reasonRaw = Reflect.get(data, "reason");
  const summaryRaw = Reflect.get(data, "summary");
  const draftReplyRaw = Reflect.get(data, "draftReply");

  if (typeof categoryRaw !== "string" || !CLASSIFICATION_CATEGORY_SET.has(categoryRaw)) {
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
  for (let attempt = 0; attempt <= CLASSIFICATION_REQUEST_MAX_RETRIES; attempt++) {
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

    await localDb.updateThreadClassification({
      userId: task.userId,
      mailboxId: task.mailboxId,
      threadId: task.threadId,
      representativeProviderMessageId: task.representativeProviderMessageId,
      classificationKey: task.classificationKey,
      category: classified.category as EmailAICategory,
      confidence: classified.confidence,
      reason: classified.reason,
      summary: classified.summary,
      draftReply: classified.draftReply,
      classifiedAt: Date.now(),
    });

    queryClient.invalidateQueries({ queryKey: queryKeys.emails.all() });
  } catch {
    // Classification is best-effort and must never block inbox rendering.
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
    onError: () => {
      // Classification failures are best-effort and non-blocking.
    },
  },
);

function enqueueClassificationTasks(
  pulled: PulledEmail[],
  userId: string,
  mailboxId: number,
): void {
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
): EmailInsert {
  const labels = new Set(email.labelIds);
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
    labelIds: JSON.stringify(email.labelIds),
    hasInbox: labels.has("INBOX"),
    hasSent: labels.has("SENT"),
    hasTrash: labels.has("TRASH"),
    hasSpam: labels.has("SPAM"),
    hasStarred: labels.has("STARRED"),
    unsubscribeUrl: email.unsubscribeUrl,
    unsubscribeEmail: email.unsubscribeEmail,
    snoozedUntil: null,
    bodyText: email.bodyText,
    bodyHtml: email.bodyHtml,
    inlineAttachments:
      email.inlineAttachments && email.inlineAttachments.length > 0
        ? JSON.stringify(email.inlineAttachments)
        : null,
    attachments:
      email.attachments && email.attachments.length > 0
        ? JSON.stringify(email.attachments)
        : null,
    hasCalendar: inferHasCalendar(email),
    aiCategory: null,
    aiConfidence: null,
    aiReason: null,
    aiSummary: null,
    aiDraftReply: null,
    aiClassifiedAt: null,
    aiClassificationKey: null,
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
  const rows = pulled.map((e) => pulledToRow(e, userId, mailboxId));
  await localDb.insertEmails(rows);
  const providerIds = pulled.map((e) => e.providerMessageId);
  const hydrated = await localDb.getEmailsByProviderMessageIds(userId, providerIds);
  const byProviderId = new Map(hydrated.map((r) => [r.providerMessageId, r]));
  enqueueClassificationTasks(pulled, userId, mailboxId);
  return providerIds
    .map((id) => byProviderId.get(id))
    .filter((e): e is EmailListItem => e !== undefined);
}

type LocalCursor = { type: "local"; beforeMs: number };
type RemoteCursor = {
  type: "remote";
  token?: string;
  beforeMs?: number;
};
type DecodedCursor = LocalCursor | RemoteCursor;

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

const refreshInFlight = new Map<string, Promise<void>>();
const refreshLastRunAt = new Map<string, number>();
const VIEW_BACKGROUND_REFRESH_COOLDOWN_MS = 60_000;

function refreshKey(mailboxId: number, view: string): string {
  return `${mailboxId}:${view}`;
}

function viewSyncedKey(mailboxId: number, view: string): string {
  return `viewSynced:${mailboxId}:${view}`;
}

export async function isViewSynced(mailboxId: number, view: string): Promise<boolean> {
  const val = await localDb.getMeta(viewSyncedKey(mailboxId, view));
  return val !== null;
}

async function markViewSynced(mailboxId: number, view: string): Promise<void> {
  await localDb.setMeta(viewSyncedKey(mailboxId, view), "1");
}

async function refreshViewFromServer(
  userId: string,
  mailboxId: number,
  view: string,
): Promise<void> {
  const key = refreshKey(mailboxId, view);
  const existing = refreshInFlight.get(key);
  if (existing) return existing;

  const now = Date.now();
  const lastRunAt = refreshLastRunAt.get(key) ?? 0;
  if (now - lastRunAt < VIEW_BACKGROUND_REFRESH_COOLDOWN_MS) {
    return;
  }
  // Mark before starting to avoid immediate invalidate->refetch->refresh loops.
  refreshLastRunAt.set(key, now);

  const task = (async () => {
    try {
      const res = await fetch("/api/inbox/view/page", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mailboxId, view, limit: VIEW_PAGE_SIZE }),
      });
      if (!res.ok) return;
      const body = (await res.json()) as {
        emails: PulledEmail[];
        cursor: string | null;
      };
      void markViewSynced(mailboxId, view);
      if (body.emails.length === 0) return;
      await persistEmails(body.emails, userId, mailboxId);
      queryClient.invalidateQueries({
        queryKey: queryKeys.emails.list(view, mailboxId),
      });
    } catch {
      /* background refresh failure is non-fatal */
    }
  })().finally(() => {
    refreshInFlight.delete(key);
  });

  refreshInFlight.set(key, task);
  return task;
}

async function fetchServerPage(
  userId: string,
  mailboxId: number,
  view: string,
  cursor: RemoteCursor,
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
    }),
  });
  if (!res.ok) throw new Error(`View fetch failed: ${res.status}`);

  const body = (await res.json()) as {
    emails: PulledEmail[];
    cursor: string | null;
  };
  const emails = await persistEmails(body.emails, userId, mailboxId);
  void markViewSynced(mailboxId, view);
  const nextCursor = body.cursor
    ? encodeViewCursor({
        type: "remote",
        token: body.cursor,
        beforeMs: cursor.beforeMs,
      })
    : null;
  return { emails, cursor: nextCursor };
}

export async function fetchViewPage(params: {
  mailboxId: number;
  view: string;
  cursor?: string;
}): Promise<ViewPage> {
  const userId = await getCurrentUserId();
  if (!userId) return { emails: [], cursor: null };

  await alignActiveUser(userId);

  const decoded = decodeViewCursor(params.cursor);

  if (decoded?.type === "remote") {
    return fetchServerPage(userId, params.mailboxId, params.view, decoded);
  }

  const beforeMs = decoded?.type === "local" ? decoded.beforeMs : undefined;
  const local = await localDb.getEmails({
    userId,
    mailboxId: params.mailboxId,
    view: params.view,
    limit: VIEW_PAGE_SIZE,
    cursor: beforeMs,
  });

  // On first page, refresh from server in background to catch new mail.
  if (!decoded) {
    void refreshViewFromServer(userId, params.mailboxId, params.view);
  }

  if (local.data.length === 0) {
    // No local data for this view — fall through to server synchronously.
    return fetchServerPage(userId, params.mailboxId, params.view, {
      type: "remote",
      beforeMs,
    });
  }

  const lastDate = local.data[local.data.length - 1]?.date;

  if (local.pagination.hasMore && lastDate != null) {
    return {
      emails: local.data,
      cursor: encodeViewCursor({ type: "local", beforeMs: lastDate }),
    };
  }

  // Local exhausted — next page switches to server, anchored at oldest local row.
  return {
    emails: local.data,
    cursor: encodeViewCursor({
      type: "remote",
      beforeMs: lastDate ?? undefined,
    }),
  };
}

export async function fetchSearchEmails(
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

export async function fetchEmailDetail(
  emailId: string,
  _context?: { mailboxId?: number; view?: string },
): Promise<EmailDetailItem> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error("Not authenticated");

  const numericId = Number(emailId);
  const local = await localDb.getEmailDetail(userId, numericId);
  if (!local) throw new Error("Email not found in local database");
  return local;
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
): Promise<ContactSuggestion[]> {
  const userId = await getCurrentUserId();
  if (!userId) return [];
  return localDb.getContactSuggestions(userId, q, limit);
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

export function getDraftsQueryKey(
  mailboxId: number | null,
): ["drafts", number | "none"] {
  return ["drafts", mailboxId ?? "none"];
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

export function invalidateInboxQueries() {
  queryClient.invalidateQueries({ queryKey: queryKeys.emails.all() });
}
