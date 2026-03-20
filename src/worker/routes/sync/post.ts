import type { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import type { Database } from "../../db/client";
import { mailboxes } from "../../db/schema";
import {
  classifySyncError,
  isGmailReconnectRequiredError,
} from "../../lib/gmail/errors";
import {
  acquireMailboxSyncLock,
  createSyncJob,
  ensureMailbox,
  getMailboxSyncSnapshot,
  markSyncJobFailed,
  markSyncJobSucceeded,
  releaseMailboxSyncLock,
  updateSyncJobProgress,
} from "../../lib/gmail/mailbox-state";
import {
  catchUpMailboxOnDemand,
  recoverMailboxSync,
  startFullGmailSync,
} from "../../lib/gmail/sync";
import {
  normalizeSyncWindowMonths,
  resolveSyncCutoffAt,
} from "../../lib/gmail/sync-preferences";
import type { AppRouteEnv } from "../types";
import { syncRequestSchema } from "./schemas";

async function isSyncInProgress(db: Database, userId: string): Promise<boolean> {
  const snapshot = await getMailboxSyncSnapshot(db, userId);
  return snapshot.hasLiveLock;
}

function runFullSyncInBackground(
  db: Database,
  env: Env,
  userId: string,
  userEmail: string,
  months?: number,
) {
  return (async () => {
    const mailbox = await ensureMailbox(db, userId, userEmail);
    if (!mailbox) return;

    const hasLock = await acquireMailboxSyncLock(db, userId, userEmail);
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
        db, env, userId,
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
      ).catch(() => {});
    } finally {
      await releaseMailboxSyncLock(db, userId).catch(() => {});
    }
  })();
}

export function registerPostSync(api: Hono<AppRouteEnv>) {
  api.post("/start", zValidator("json", syncRequestSchema), async (c) => {
    const db = c.get("db");
    const user = c.get("user")!;

    const { months } = c.req.valid("json");
    if (await isSyncInProgress(db, user.id)) {
      return c.json({ error: "Sync already in progress" }, 409);
    }

    c.executionCtx.waitUntil(
      runFullSyncInBackground(db, c.env, user.id, user.email, months),
    );
    return c.json({ data: { status: "started" } }, 202);
  });

  api.post("/incremental", zValidator("json", syncRequestSchema), async (c) => {
    const db = c.get("db");
    const user = c.get("user")!;

    c.req.valid("json");
    const result = await catchUpMailboxOnDemand(
      db, c.env, user.id, user.email, { force: true },
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

    c.executionCtx.waitUntil(
      recoverMailboxSync(db, c.env, user.id, user.email),
    );

    return c.json({ data: { status: "started" } }, 202);
  });
}
