import type { EmailListItem, EmailListResponse } from "@/features/email/inbox/types";
import { syncLabelsFromServer } from "@/features/email/labels/queries";
import { queryClient } from "@/lib/query-client";
import { queryKeys } from "@/lib/query-keys";
import { localDb } from "./client";
import type { EmailInsert } from "./schema";

const SYNC_PAGE_SIZE = 20;
const SYNCED_MAILBOX_KEY_PREFIX = "synced-mailbox";
const SYNCED_ANY_KEY_PREFIX = "synced-any";
const ACTIVE_USER_META_KEY = "active-user-id";

const syncInFlight = new Map<string, Promise<void>>();

function mailboxSyncKey(userId: string, mailboxId: number) {
  return `${SYNCED_MAILBOX_KEY_PREFIX}:${userId}:${mailboxId}`;
}

function userSyncKey(userId: string) {
  return `${SYNCED_ANY_KEY_PREFIX}:${userId}`;
}

function syncTaskKey(userId: string, mailboxId: number) {
  return `${userId}:${mailboxId}`;
}

type SyncEmailListItem = EmailListItem & {
  bodyText?: string | null;
  bodyHtml?: string | null;
};

function emailListItemToRow(item: SyncEmailListItem, userId: string): EmailInsert {
  const labelIds = item.labelIds ?? [];
  const labels = new Set(labelIds);
  return {
    id: Number(item.id),
    userId,
    mailboxId: item.mailboxId,
    providerMessageId: item.providerMessageId,
    fromAddr: item.fromAddr,
    fromName: item.fromName,
    toAddr: item.toAddr,
    ccAddr: item.ccAddr,
    subject: item.subject,
    snippet: item.snippet,
    threadId: item.threadId,
    date: item.date,
    direction: item.direction,
    isRead: item.isRead,
    labelIds: JSON.stringify(labelIds),
    hasInbox: labels.has("INBOX"),
    hasSent: labels.has("SENT"),
    hasTrash: labels.has("TRASH"),
    hasSpam: labels.has("SPAM"),
    hasStarred: labels.has("STARRED"),
    unsubscribeUrl: item.unsubscribeUrl,
    unsubscribeEmail: item.unsubscribeEmail,
    snoozedUntil: item.snoozedUntil,
    bodyText: item.bodyText ?? null,
    bodyHtml: item.bodyHtml ?? null,
    createdAt: item.createdAt,
  };
}

async function fetchEmailPage(
  mailboxId: number,
  offset: number,
): Promise<EmailListResponse> {
  const query = new URLSearchParams({
    view: "all",
    mailboxId: String(mailboxId),
    limit: String(SYNC_PAGE_SIZE),
    offset: String(offset),
    includeBody: "true",
  });

  const response = await fetch(`/api/inbox/emails?${query}`);
  if (!response.ok) {
    throw new Error("Sync fetch failed");
  }
  return response.json();
}

async function pullAll(userId: string, mailboxId: number): Promise<number> {
  let offset = 0;
  let hasMore = true;
  let totalInserted = 0;

  while (hasMore) {
    const page = await fetchEmailPage(mailboxId, offset);
    const items = page.data as SyncEmailListItem[];
    if (items.length === 0) break;

    const emailRows = items.map((item) => emailListItemToRow(item, userId));
    await localDb.insertEmails(emailRows);
    totalInserted += items.length;

    // Show emails progressively as each page lands
    queryClient.invalidateQueries({ queryKey: queryKeys.emails.all() });

    hasMore = page.pagination.hasMore;
    offset += items.length;
  }

  return totalInserted;
}

async function alignActiveUser(userId: string) {
  const activeUser = await localDb.getMeta(ACTIVE_USER_META_KEY);
  if (activeUser && activeUser !== userId) {
    await localDb.clear();
  }
  await localDb.setMeta(ACTIVE_USER_META_KEY, userId);
}

async function runInitialSync(
  userId: string,
  mailboxId: number,
) {
  await localDb.ensureReady();
  await alignActiveUser(userId);

  const mailboxKey = mailboxSyncKey(userId, mailboxId);
  if ((await localDb.getMeta(mailboxKey)) === "true") return;

  const inserted = await pullAll(userId, mailboxId);
  await syncLabelsFromServer(mailboxId).catch((err) => {
    console.warn("Label sync failed during initial sync", err);
  });

  // Only mark as synced if we actually got emails — the server-side
  // Gmail→D1 sync may still be in progress, so we'll retry next visit.
  if (inserted > 0) {
    await localDb.setMeta(mailboxKey, "true");
    await localDb.setMeta(userSyncKey(userId), "true");
  }
}

/**
 * Pull the newest page of emails from D1 and upsert into local SQLite.
 * Called on each poll tick while the server-side sync is running so
 * new emails appear progressively without a full re-sync.
 */
export async function pullNewEmails(userId: string, mailboxId: number) {
  await localDb.ensureReady();
  const page = await fetchEmailPage(mailboxId, 0);
  const items = page.data as SyncEmailListItem[];
  if (items.length === 0) return;
  const emailRows = items.map((item) => emailListItemToRow(item, userId));
  await localDb.insertEmails(emailRows);
}

export async function ensureLocalSync(
  userId: string,
  mailboxId: number,
) {
  const key = syncTaskKey(userId, mailboxId);
  const running = syncInFlight.get(key);
  if (running) {
    await running;
    if (await isSynced(userId, mailboxId)) {
      return;
    }
  }

  const task = runInitialSync(userId, mailboxId).finally(() => {
    syncInFlight.delete(key);
  });

  syncInFlight.set(key, task);
  return task;
}

export async function isSynced(
  userId: string,
  mailboxId?: number,
): Promise<boolean> {
  await localDb.ensureReady();

  if (mailboxId != null) {
    const flagSet = (await localDb.getMeta(mailboxSyncKey(userId, mailboxId))) === "true";
    if (!flagSet) return false;
    // Guard against stale meta flag (e.g. after sqlite driver migration)
    const count = await localDb.emailCount(userId, mailboxId);
    if (count === 0) {
      await localDb.setMeta(mailboxSyncKey(userId, mailboxId), "");
      await localDb.setMeta(userSyncKey(userId), "");
      return false;
    }
    return true;
  }

  return (await localDb.getMeta(userSyncKey(userId))) === "true";
}

export async function clearLocalData() {
  syncInFlight.clear();

  try {
    await localDb.ensureReady();
    await localDb.clear();
  } catch {
    // Ignore worker shutdown/initialization races during logout.
  }
}
