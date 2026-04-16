import { syncLabelsFromServer } from "@/features/email/labels/queries";
import { queryClient } from "@/lib/query-client";
import { queryKeys } from "@/lib/query-keys";
import { localDb } from "./client";
import { replayPendingMutations, resetMutationQueue } from "./mutation-queue";
import type { EmailInsert } from "./schema";

const SYNCED_MAILBOX_KEY_PREFIX = "synced-mailbox";
const SYNCED_ANY_KEY_PREFIX = "synced-any";
const ACTIVE_USER_META_KEY = "active-user-id";

const syncInFlight = new Map<string, Promise<void>>();

export type LocalSyncStatus = "idle" | "initial" | "refresh";

export type LocalSyncSnapshot = {
  status: LocalSyncStatus;
  pulled: number;
  total: number | null;
};

const IDLE_SNAPSHOT: LocalSyncSnapshot = {
  status: "idle",
  pulled: 0,
  total: null,
};

const progress = new Map<string, LocalSyncSnapshot>();
const progressListeners = new Set<() => void>();

function notifyProgress() {
  for (const listener of progressListeners) listener();
}

function setProgress(key: string, snapshot: LocalSyncSnapshot) {
  if (snapshot.status === "idle") {
    progress.delete(key);
  } else {
    progress.set(key, snapshot);
  }
  notifyProgress();
}

export function subscribeLocalSync(listener: () => void) {
  progressListeners.add(listener);
  return () => {
    progressListeners.delete(listener);
  };
}

export function getLocalSyncSnapshot(
  userId: string | null | undefined,
  mailboxId: number | null | undefined,
): LocalSyncSnapshot {
  if (!userId || mailboxId == null) return IDLE_SNAPSHOT;
  return progress.get(syncTaskKey(userId, mailboxId)) ?? IDLE_SNAPSHOT;
}

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
async function pullAll(
  userId: string,
  mailboxId: number,
  status: Exclude<LocalSyncStatus, "idle">,
): Promise<number> {
  const key = syncTaskKey(userId, mailboxId);
  let cursor: string | undefined;
  let totalInserted = 0;

  setProgress(key, { status, pulled: 0, total: null });

  try {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const page = await pullPage(mailboxId, cursor);

      if (page.requiresFullSync) {
        cursor = undefined;
        totalInserted = 0;
        setProgress(key, { status, pulled: 0, total: null });
        continue;
      }

      if (page.deleted.length > 0) {
        await localDb.deleteEmailsByProviderMessageId(page.deleted);
      }

      if (page.emails.length > 0) {
        const rows = page.emails.map((e) => pulledEmailToRow(e, userId, mailboxId));
        await localDb.insertEmails(rows);
        totalInserted += rows.length;

        setProgress(key, { status, pulled: totalInserted, total: null });
        queryClient.invalidateQueries({ queryKey: queryKeys.emails.all() });
      }

      if (!page.cursor) break;
      cursor = page.cursor;
    }
  } finally {
    setProgress(key, IDLE_SNAPSHOT);
  }

  return totalInserted;
}

/**
 * Pull new/changed emails via incremental sync (History API).
 * Called on each poll tick after initial sync is complete.
 */
export async function pullNewEmails(userId: string, mailboxId: number) {
  await localDb.ensureReady();
  await replayPendingMutations(userId);

  const key = syncTaskKey(userId, mailboxId);
  let cursor: string | undefined;
  let totalInserted = 0;
  let announced = false;

  try {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const page = await pullPage(mailboxId, cursor);

      if (page.requiresFullSync) {
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
        totalInserted += rows.length;
        announced = true;
        setProgress(key, { status: "refresh", pulled: totalInserted, total: null });
      }

      if (!page.cursor) break;
      cursor = page.cursor;
    }
  } finally {
    if (announced) setProgress(key, IDLE_SNAPSHOT);
  }
}

async function alignActiveUser(userId: string) {
  const activeUser = await localDb.getMeta(ACTIVE_USER_META_KEY);
  if (activeUser && activeUser !== userId) {
    resetMutationQueue();
    await localDb.clear();
  }
  await localDb.setMeta(ACTIVE_USER_META_KEY, userId);
  await replayPendingMutations(userId);
}

async function runInitialSync(
  userId: string,
  mailboxId: number,
) {
  await localDb.ensureReady();
  await alignActiveUser(userId);

  const mailboxKey = mailboxSyncKey(userId, mailboxId);
  if ((await localDb.getMeta(mailboxKey)) === "true") return;

  await Promise.all([
    pullAll(userId, mailboxId, "initial"),
    syncLabelsFromServer(mailboxId).catch((err) => {
      console.warn("Label sync failed during initial sync", err);
    }),
  ]);

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
  resetMutationQueue();

  try {
    await localDb.ensureReady();
    await localDb.deleteDatabase();
  } catch {
    // Ignore worker shutdown/initialization races during logout.
  }
}
