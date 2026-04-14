import { syncLabelsFromServer } from "@/features/email/labels/queries";
import { queryClient } from "@/lib/query-client";
import { queryKeys } from "@/lib/query-keys";
import { localDb } from "./client";
import type { EmailInsert } from "./schema";

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

/** Shape returned by POST /api/inbox/sync/pull */
type PullResponse = {
  emails: PulledEmail[];
  deleted: string[];
  cursor: string | null;
  total: number;
  error?: string;
  requiresFullSync?: boolean;
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
};

function pulledEmailToRow(email: PulledEmail, userId: string, mailboxId: number): EmailInsert {
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
    createdAt: email.date,
  };
}

async function pullPage(
  mailboxId: number,
  cursor?: string,
): Promise<PullResponse> {
  const response = await fetch("/api/inbox/sync/pull", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mailboxId, cursor }),
  });

  if (response.status === 409) {
    const data = await response.json();
    return { emails: [], deleted: [], cursor: null, total: 0, ...data };
  }

  if (!response.ok) {
    throw new Error(`Sync pull failed: ${response.status}`);
  }

  return response.json();
}

/**
 * Pull all emails from Gmail via the worker proxy.
 * Inserts each batch into OPFS progressively, invalidating queries so
 * emails appear in the UI as they arrive.
 */
async function pullAll(userId: string, mailboxId: number): Promise<number> {
  let cursor: string | undefined;
  let totalInserted = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const page = await pullPage(mailboxId, cursor);

    // Handle history expired — retry as full sync (clear cursor)
    if (page.requiresFullSync) {
      cursor = undefined;
      continue;
    }

    // Handle deletions
    if (page.deleted.length > 0) {
      await localDb.deleteEmailsByProviderMessageId(page.deleted);
    }

    // Insert new/updated emails
    if (page.emails.length > 0) {
      const rows = page.emails.map((e) => pulledEmailToRow(e, userId, mailboxId));
      await localDb.insertEmails(rows);
      totalInserted += rows.length;

      queryClient.invalidateQueries({ queryKey: queryKeys.emails.all() });
    }

    if (!page.cursor) break;
    cursor = page.cursor;
  }

  return totalInserted;
}

/**
 * Pull new/changed emails via incremental sync (History API).
 * Called on each poll tick after initial sync is complete.
 */
export async function pullNewEmails(userId: string, mailboxId: number) {
  await localDb.ensureReady();

  let cursor: string | undefined;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const page = await pullPage(mailboxId, cursor);

    if (page.requiresFullSync) {
      // History expired — need full re-sync. Clear synced flag so next query triggers it.
      await localDb.setMeta(mailboxSyncKey(userId, mailboxId), "");
      await localDb.setMeta(userSyncKey(userId), "");
      return;
    }

    if (page.deleted.length > 0) {
      await localDb.deleteEmailsByProviderMessageId(page.deleted);
    }

    if (page.emails.length > 0) {
      const rows = page.emails.map((e) => pulledEmailToRow(e, userId, mailboxId));
      await localDb.insertEmails(rows);
    }

    if (!page.cursor) break;
    cursor = page.cursor;
  }
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

  // Sync labels in parallel with email pulling — labels are fast and
  // should appear immediately, not after all email pages finish.
  const [inserted] = await Promise.all([
    pullAll(userId, mailboxId),
    syncLabelsFromServer(mailboxId).catch((err) => {
      console.warn("Label sync failed during initial sync", err);
    }),
  ]);

  if (inserted > 0) {
    await localDb.setMeta(mailboxKey, "true");
    await localDb.setMeta(userSyncKey(userId), "true");
  }
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
