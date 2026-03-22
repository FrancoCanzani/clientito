import type { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import type { Database } from "../../../db/client";
import { mailboxes } from "../../../db/schema";
import {
  classifySyncError,
  isGmailReconnectRequiredError,
} from "../../../lib/email/providers/google/errors";
import {
  acquireMailboxSyncLock,
  createSyncJob,
  getMailboxSyncSnapshot,
  resolveMailbox,
  markSyncJobFailed,
  markSyncJobSucceeded,
  releaseMailboxSyncLock,
  updateSyncJobProgress,
} from "../../../lib/email/mailbox-state";
import {
  catchUpMailboxOnDemand,
  recoverMailboxSync,
  startFullGmailSync,
} from "../../../lib/email/providers/google/sync";
import {
  normalizeSyncWindowMonths,
  resolveSyncCutoffAt,
} from "../../../lib/email/sync-preferences";
import type { AppRouteEnv } from "../../types";
import { syncRequestSchema } from "./schemas";

async function isSyncInProgress(db: Database, mailboxId: number): Promise<boolean> {
  const snapshot = await getMailboxSyncSnapshot(db, mailboxId);
  return snapshot.hasLiveLock;
}

function runFullSyncInBackground(
  db: Database,
  env: Env,
  userId: string,
  mailboxId?: number,
  months?: number,
) {
  return (async () => {
    const mailbox = await resolveMailbox(db, userId, mailboxId);
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
          .set({
            syncWindowMonths,
            syncCutoffAt,
            updatedAt: Date.now(),
          })
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
        console.error("Full sync failed", { userId, error });
      }
      await markSyncJobFailed(
        db, mailbox.id, job.id, message, classifySyncError(error),
      ).catch((e) => console.error("Failed to mark sync job as failed", { mailboxId: mailbox.id, error: e }));
    } finally {
      await releaseMailboxSyncLock(db, mailbox.id).catch((e) => console.error("Failed to release sync lock", { mailboxId: mailbox.id, error: e }));
    }
  })();
}

export function registerPostSync(api: Hono<AppRouteEnv>) {
  api.post("/start", zValidator("json", syncRequestSchema), async (c) => {
    const db = c.get("db");
    const user = c.get("user")!;

    const { months, mailboxId } = c.req.valid("json");
    const mailbox = await resolveMailbox(db, user.id, mailboxId);
    if (mailbox && await isSyncInProgress(db, mailbox.id)) {
      return c.json({ error: "Sync already in progress" }, 409);
    }

    c.executionCtx.waitUntil(
      runFullSyncInBackground(db, c.env, user.id, mailboxId, months),
    );
    return c.json({ data: { status: "started" } }, 202);
  });

  api.post("/incremental", zValidator("json", syncRequestSchema), async (c) => {
    const db = c.get("db");
    const user = c.get("user")!;

    const { mailboxId } = c.req.valid("json");
    const mailbox = await resolveMailbox(db, user.id, mailboxId);
    if (!mailbox) {
      return c.json({ error: "No mailbox found" }, 400);
    }

    const result = await catchUpMailboxOnDemand(
      db, c.env, mailbox.id, user.id, { force: true },
    );

    if (result.status === "skipped" && result.reason === "sync_in_progress") {
      return c.json({ error: "Sync already in progress" }, 409);
    }

    if (result.status === "failed") {
      return c.json({ error: result.error }, 500);
    }

    return c.json({ data: { status: result.status } }, 200);
  });

  api.post("/recover", async (c) => {
    const db = c.get("db");
    const user = c.get("user")!;

    const mailbox = await resolveMailbox(db, user.id);
    if (!mailbox) {
      return c.json({ error: "No mailbox found" }, 400);
    }

    c.executionCtx.waitUntil(
      recoverMailboxSync(db, c.env, mailbox.id, user.id),
    );

    return c.json({ data: { status: "started" } }, 202);
  });
}
