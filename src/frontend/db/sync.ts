import type { EmailListItem, EmailListResponse } from "@/features/email/inbox/types";
import { syncLabelsFromServer } from "@/features/email/labels/queries";
import { queryClient } from "@/lib/query-client";
import { queryKeys } from "@/lib/query-keys";
import { localDb } from "./client";
import type { emails } from "./schema";

const SYNC_PAGE_SIZE = 200;
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

function emailListItemToRow(item: SyncEmailListItem, userId: string): typeof emails.$inferInsert {
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

async function pullAll(userId: string, mailboxId: number) {
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const page = await fetchEmailPage(mailboxId, offset);
    const items = page.data as SyncEmailListItem[];
    if (items.length === 0) break;

    const emailRows = items.map((item) => emailListItemToRow(item, userId));
    await localDb.insertEmails(emailRows);

    hasMore = page.pagination.hasMore;
    offset += items.length;
  }

  queryClient.invalidateQueries({ queryKey: queryKeys.emails.all() });
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

  await pullAll(userId, mailboxId);
  await syncLabelsFromServer(mailboxId).catch((err) => {
    console.warn("Label sync failed during initial sync", err);
  });

  await localDb.setMeta(mailboxKey, "true");
  await localDb.setMeta(userSyncKey(userId), "true");
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
    return (await localDb.getMeta(mailboxSyncKey(userId, mailboxId))) === "true";
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
