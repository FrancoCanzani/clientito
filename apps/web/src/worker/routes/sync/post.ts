import type { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import type { Database } from "../../db/client";
import {
  GmailSyncStateError,
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
  startFullGmailSync,
} from "../../lib/gmail/sync";
import type { AppRouteEnv } from "../types";
import { syncRequestSchema } from "./schemas";

function monthsToGmailQuery(months?: number): string | undefined {
  if (!months) return undefined;
  const after = new Date();
  after.setMonth(after.getMonth() - months);
  const y = after.getFullYear();
  const m = String(after.getMonth() + 1).padStart(2, "0");
  const d = String(after.getDate()).padStart(2, "0");
  return `after:${y}/${m}/${d}`;
}

function classifySyncError(error: unknown) {
  if (isGmailReconnectRequiredError(error)) {
    return "reconnect_required" as const;
  }

  if (
    error instanceof Error &&
    error.message.toLowerCase().includes("full sync again")
  ) {
    return "history_expired" as const;
  }

  if (error instanceof GmailSyncStateError) {
    return "state_error" as const;
  }

  return "sync_failed" as const;
}

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
  continueFullSync?: boolean,
) {
  return (async () => {
    const mailbox = await ensureMailbox(db, userId, userEmail);
    const hasLock = await acquireMailboxSyncLock(db, userId, userEmail);
    if (!hasLock) {
      return;
    }

    const job = await createSyncJob(db, mailbox.id, "full", "manual");

    try {
      const gmailQuery = monthsToGmailQuery(months);
      const shouldRunFollowUpFullSync =
        continueFullSync === true && Boolean(gmailQuery);

      await startFullGmailSync(
        db,
        env,
        userId,
        (phase, current, total) =>
          updateSyncJobProgress(db, mailbox.id, job.id, phase, current, total),
        gmailQuery,
        { skipLock: true },
      );

      if (shouldRunFollowUpFullSync) {
        await startFullGmailSync(
          db,
          env,
          userId,
          (phase, current, total) =>
            updateSyncJobProgress(
              db,
              mailbox.id,
              job.id,
              phase,
              current,
              total,
            ),
          undefined,
          { skipLock: true },
        );
      }

      await markSyncJobSucceeded(db, mailbox.id, job.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Sync failed";
      if (isGmailReconnectRequiredError(error)) {
        console.warn("Background full sync requires Google reconnect", { userId });
      } else {
        console.error("Background full sync failed", { userId, error });
      }
      await markSyncJobFailed(
        db,
        mailbox.id,
        job.id,
        message,
        classifySyncError(error),
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

    const { months, continueFullSync } = c.req.valid("json");
    if (await isSyncInProgress(db, user.id)) {
      return c.json({ error: "Sync already in progress" }, 409);
    }

    c.executionCtx.waitUntil(
      runFullSyncInBackground(
        db,
        c.env,
        user.id,
        user.email,
        months,
        continueFullSync,
      ),
    );
    return c.json({ data: { status: "started" } }, 202);
  });

  api.post("/incremental", zValidator("json", syncRequestSchema), async (c) => {
    const db = c.get("db");
    const user = c.get("user")!;

    c.req.valid("json");
    const result = await catchUpMailboxOnDemand(
      db,
      c.env,
      user.id,
      user.email,
      { force: true },
    );

    if (
      result.status === "skipped" &&
      result.reason === "sync_in_progress"
    ) {
      return c.json({ error: "Sync already in progress" }, 409);
    }

    if (result.status === "failed") {
      return c.json({ error: result.error }, 500);
    }

    return c.json({ data: { status: result.status } }, 200);
  });
}
