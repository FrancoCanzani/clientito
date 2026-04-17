import { syncLabelsFromServer } from "@/features/email/labels/queries";
import { viewToGmailFilter } from "@/features/email/inbox/utils/view-gmail-filter";
import { queryClient } from "@/lib/query-client";
import { queryKeys } from "@/lib/query-keys";
import { localDb } from "./client";
import type { EmailInsert } from "./schema";

const SYNCED_KEY_PREFIX = "synced-mailbox";
const ACTIVE_USER_KEY = "active-user-id";

const syncInFlight = new Map<string, Promise<void>>();
const backfillInFlight = new Map<
  string,
  Promise<{ inserted: number; hasMore: boolean }>
>();
const searchInFlight = new Map<string, Promise<number>>();

export type LocalSyncStatus = "idle" | "initial" | "refresh";

export type LocalSyncSnapshot = {
  status: LocalSyncStatus;
  pulled: number;
};

const IDLE: LocalSyncSnapshot = { status: "idle", pulled: 0 };

const progress = new Map<string, LocalSyncSnapshot>();
const listeners = new Set<() => void>();

function taskKey(userId: string, mailboxId: number) {
  return `${userId}:${mailboxId}`;
}

function syncedKey(userId: string, mailboxId: number) {
  return `${SYNCED_KEY_PREFIX}:${userId}:${mailboxId}`;
}

function setProgress(key: string, snap: LocalSyncSnapshot) {
  if (snap.status === "idle") progress.delete(key);
  else progress.set(key, snap);
  for (const l of listeners) l();
}

export function subscribeLocalSync(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getLocalSyncSnapshot(
  userId: string | null | undefined,
  mailboxId: number | null | undefined,
): LocalSyncSnapshot {
  if (!userId || mailboxId == null) return IDLE;
  return progress.get(taskKey(userId, mailboxId)) ?? IDLE;
}

type PullResponse = {
  emails: PulledEmail[];
  deleted: string[];
  cursor: string | null;
  requiresFullSync?: boolean;
};

type PulledInlineAttachment = {
  contentId: string;
  attachmentId: string;
  mimeType: string | null;
  filename: string | null;
};

type PulledAttachment = {
  attachmentId: string;
  filename: string | null;
  mimeType: string | null;
  size: number | null;
  contentId: string | null;
  isInline: boolean;
  isImage: boolean;
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
  inlineAttachments?: PulledInlineAttachment[];
  attachments?: PulledAttachment[];
};

function pulledEmailToRow(
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
    createdAt: email.date,
  };
}

async function postPull(url: string, body: object): Promise<PullResponse> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.status === 409) {
    return { emails: [], deleted: [], cursor: null, ...(await res.json()) };
  }
  if (!res.ok) throw new Error(`Sync failed: ${res.status}`);
  return res.json();
}

async function applyPage(
  userId: string,
  mailboxId: number,
  page: PullResponse,
) {
  if (page.deleted.length > 0) {
    await localDb.deleteEmailsByProviderMessageId(page.deleted);
  }
  if (page.emails.length > 0) {
    const rows = page.emails.map((e) => pulledEmailToRow(e, userId, mailboxId));
    await localDb.insertEmails(rows);
    queryClient.invalidateQueries({ queryKey: queryKeys.emails.all() });
  }
}

async function alignActiveUser(userId: string) {
  const active = await localDb.getMeta(ACTIVE_USER_KEY);
  if (active && active !== userId) {
    await localDb.clear();
  }
  await localDb.setMeta(ACTIVE_USER_KEY, userId);
}

/**
 * Drives sync for a mailbox. The server's /pull endpoint auto-routes between
 * full sync (no historyId yet) and incremental (history delta), so this same
 * loop handles both initial import and ongoing refreshes.
 */
async function runSync(userId: string, mailboxId: number) {
  const key = taskKey(userId, mailboxId);
  const wasSynced =
    (await localDb.getMeta(syncedKey(userId, mailboxId))) === "true";
  const status: LocalSyncStatus = wasSynced ? "refresh" : "initial";

  let pulled = 0;
  setProgress(key, { status, pulled });

  // Fire labels in parallel with email pulls so the sidebar lights up early
  // instead of waiting for the whole pull loop to finish.
  const labelsTask = wasSynced
    ? Promise.resolve()
    : syncLabelsFromServer(mailboxId)
        .then(() => {
          queryClient.invalidateQueries({
            queryKey: queryKeys.labels(mailboxId),
          });
        })
        .catch((err) => {
          console.warn("Label sync failed", err);
        });

  try {
    let cursor: string | undefined;
    while (true) {
      const page = await postPull("/api/inbox/sync/pull", { mailboxId, cursor });

      if (page.requiresFullSync) {
        await localDb.setMeta(syncedKey(userId, mailboxId), "");
        cursor = undefined;
        continue;
      }

      await applyPage(userId, mailboxId, page);
      pulled += page.emails.length;
      setProgress(key, { status, pulled });

      if (!page.cursor) break;
      cursor = page.cursor;
    }

    await localDb.setMeta(syncedKey(userId, mailboxId), "true");
    await labelsTask;
  } finally {
    setProgress(key, IDLE);
  }
}

export function ensureLocalSync(userId: string, mailboxId: number) {
  const key = taskKey(userId, mailboxId);
  const existing = syncInFlight.get(key);
  if (existing) return existing;

  const task = (async () => {
    await localDb.ensureReady();
    await alignActiveUser(userId);
    await runSync(userId, mailboxId);
  })().finally(() => {
    syncInFlight.delete(key);
  });

  syncInFlight.set(key, task);
  return task;
}

export const pullNewEmails = ensureLocalSync;

export async function isSynced(userId: string, mailboxId: number) {
  await localDb.ensureReady();
  return (await localDb.getMeta(syncedKey(userId, mailboxId))) === "true";
}

/**
 * Pull the next page of older messages for a specific view from Gmail.
 * Anchored to the oldest local message in that view so we walk strictly
 * backwards. One call = one page; click again for more.
 */
export function pullViewMore(
  userId: string,
  mailboxId: number,
  view: string,
  options?: { extraQuery?: string; beforeMs?: number },
): Promise<{ inserted: number; hasMore: boolean }> {
  const filter = viewToGmailFilter(view);
  if (!filter) return Promise.resolve({ inserted: 0, hasMore: false });

  const extra = options?.extraQuery?.trim();
  const combinedQuery = [filter.query, extra].filter(Boolean).join(" ") || undefined;

  const key = `${userId}:${mailboxId}:${view}:${extra ?? ""}:${options?.beforeMs ?? ""}`;
  const existing = backfillInFlight.get(key);
  if (existing) return existing;

  const task = (async () => {
    await localDb.ensureReady();
    let beforeMs = options?.beforeMs;
    if (beforeMs === undefined) {
      const meta = await localDb.getViewMeta({ userId, mailboxId, view });
      beforeMs = meta.oldestDateMs ?? undefined;
    }
    const page = await postPull("/api/inbox/sync/pull-view", {
      mailboxId,
      query: combinedQuery,
      labelIds: filter.labelIds,
      beforeMs,
    });
    await applyPage(userId, mailboxId, page);
    return { inserted: page.emails.length, hasMore: !!page.cursor };
  })().finally(() => {
    backfillInFlight.delete(key);
  });

  backfillInFlight.set(key, task);
  return task;
}

export async function remoteSearch(
  userId: string,
  mailboxId: number,
  query: string,
): Promise<number> {
  const key = `${userId}:${mailboxId}:${query}`;
  const existing = searchInFlight.get(key);
  if (existing) return existing;

  const task = (async () => {
    try {
      const res = await fetch("/api/inbox/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mailboxId, q: query }),
      });
      if (!res.ok) return 0;
      const page = (await res.json()) as PullResponse;
      if (page.emails.length === 0) return 0;
      const rows = page.emails.map((e) =>
        pulledEmailToRow(e, userId, mailboxId),
      );
      await localDb.insertEmails(rows);
      return rows.length;
    } catch {
      return 0;
    }
  })().finally(() => {
    searchInFlight.delete(key);
  });

  searchInFlight.set(key, task);
  return task;
}

export async function clearLocalData() {
  syncInFlight.clear();
  backfillInFlight.clear();
  searchInFlight.clear();
  try {
    await localDb.ensureReady();
    await localDb.deleteDatabase();
  } catch {
    // Ignore worker shutdown/initialization races during logout.
  }
}
