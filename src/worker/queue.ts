import { eq } from "drizzle-orm";
import { createDb } from "./db/client";
import { mailboxes } from "./db/schema";
import {
  classifySyncError,
  isGmailReconnectRequiredError,
} from "./lib/gmail/errors";
import {
  acquireMailboxSyncLock,
  createSyncJob,
  markSyncJobFailed,
  markSyncJobSucceeded,
  releaseMailboxSyncLock,
  updateSyncJobProgress,
} from "./lib/gmail/sync/state";
import { resolveMailbox } from "./lib/gmail/mailboxes";
import {
  recoverMailboxSync,
  startFullGmailSync,
} from "./lib/gmail/sync/engine";
import {
  normalizeSyncWindowMonths,
  resolveSyncCutoffAt,
} from "./lib/gmail/sync/preferences";

export type SyncQueueMessage =
  | { type: "full-sync"; userId: string; mailboxId?: number; months?: number }
  | { type: "recover-sync"; userId: string; mailboxId: number };

async function handleFullSync(env: Env, msg: Extract<SyncQueueMessage, { type: "full-sync" }>) {
  const db = createDb(env.DB);
  const { userId, months } = msg;

  const mailbox = await resolveMailbox(db, userId, msg.mailboxId);
  if (!mailbox) return;

  const hasLock = await acquireMailboxSyncLock(db, mailbox.id);
  if (!hasLock) return;

  const job = await createSyncJob(db, mailbox.id, "full", "manual");

  try {
    const syncWindowMonths = months === undefined
      ? (mailbox.syncWindowMonths ?? null)
      : normalizeSyncWindowMonths(months);
    const syncCutoffAt = months === undefined
      ? (mailbox.syncCutoffAt ?? null)
      : resolveSyncCutoffAt(syncWindowMonths);

    if (months !== undefined) {
      await db
        .update(mailboxes)
        .set({ syncWindowMonths, syncCutoffAt, updatedAt: Date.now() })
        .where(eq(mailboxes.id, mailbox.id));
    }

    await startFullGmailSync(
      db, env, mailbox.id, userId,
      (phase, current, total) =>
        updateSyncJobProgress(db, mailbox.id, job.id, phase, current, total),
      { skipLock: true, cutoffAt: syncCutoffAt },
    );

    await markSyncJobSucceeded(db, mailbox.id, job.id);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sync failed";
    if (isGmailReconnectRequiredError(error)) {
      console.warn("Full sync requires Google reconnect", { userId });
    } else {
      console.error("Full sync failed", { userId, error: message });
    }
    await markSyncJobFailed(
      db, mailbox.id, job.id, message, classifySyncError(error),
    ).catch(() => {});
    throw error;
  } finally {
    await releaseMailboxSyncLock(db, mailbox.id).catch(() => {});
  }
}

async function handleRecoverSync(env: Env, msg: Extract<SyncQueueMessage, { type: "recover-sync" }>) {
  const db = createDb(env.DB);
  await recoverMailboxSync(db, env, msg.mailboxId, msg.userId);
}

export async function handleSyncQueue(
  batch: MessageBatch<SyncQueueMessage>,
  env: Env,
) {
  for (const message of batch.messages) {
    try {
      switch (message.body.type) {
        case "full-sync":
          await handleFullSync(env, message.body);
          break;
        case "recover-sync":
          await handleRecoverSync(env, message.body);
          break;
      }
      message.ack();
    } catch (error) {
      console.error(`Queue message failed: ${message.body.type}`, error instanceof Error ? error.message : error);
      message.retry();
    }
  }
}
