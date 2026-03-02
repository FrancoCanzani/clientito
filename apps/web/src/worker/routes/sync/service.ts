import { eq } from "drizzle-orm";
import type { Database } from "../../db/client";
import { syncState } from "../../db/schema";
import {
  isGmailReconnectRequiredError,
  runIncrementalGmailSync,
  startFullGmailSync,
} from "../../lib/gmail";
import { monthsToGmailQuery } from "./helpers";

const SYNC_PROGRESS_LOCK_TTL_MS = 4 * 60_000;

export async function updateSyncProgress(
  db: Database,
  userId: string,
  phase: string,
  current: number,
  total: number,
) {
  const now = Date.now();
  await db
    .update(syncState)
    .set({
      phase,
      progressCurrent: current,
      progressTotal: total,
      error: null,
      lockUntil: now + SYNC_PROGRESS_LOCK_TTL_MS,
    })
    .where(eq(syncState.userId, userId));
}

export async function clearSyncProgress(db: Database, userId: string) {
  await db
    .update(syncState)
    .set({
      phase: null,
      progressCurrent: null,
      progressTotal: null,
      lockUntil: null,
    })
    .where(eq(syncState.userId, userId));
}

export async function setSyncError(db: Database, userId: string, message: string) {
  await db
    .update(syncState)
    .set({
      phase: "error",
      progressCurrent: null,
      progressTotal: null,
      error: message,
      lockUntil: null,
    })
    .where(eq(syncState.userId, userId));
}

export function runFullSyncInBackground(
  db: Database,
  env: Env,
  userId: string,
  months?: number,
  continueFullSync?: boolean,
) {
  return (async () => {
    try {
      const gmailQuery = monthsToGmailQuery(months);
      const shouldRunFollowUpFullSync = continueFullSync === true && Boolean(gmailQuery);
      await startFullGmailSync(
        db,
        env,
        userId,
        (phase, current, total) => updateSyncProgress(db, userId, phase, current, total),
        gmailQuery,
      );

      if (shouldRunFollowUpFullSync) {
        await startFullGmailSync(
          db,
          env,
          userId,
          (phase, current, total) => updateSyncProgress(db, userId, phase, current, total),
        );
      }

      await clearSyncProgress(db, userId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Sync failed";
      if (isGmailReconnectRequiredError(error)) {
        console.warn("Background full sync requires Google reconnect", { userId });
      } else {
        console.error("Background full sync failed", { userId, error });
      }
      await setSyncError(db, userId, message).catch(() => {});
    }
  })();
}

export function runIncrementalSyncInBackground(
  db: Database,
  env: Env,
  userId: string,
) {
  return (async () => {
    try {
      await updateSyncProgress(db, userId, "syncing", 0, 0);
      await runIncrementalGmailSync(db, env, userId);

      await clearSyncProgress(db, userId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Sync failed";
      if (isGmailReconnectRequiredError(error)) {
        console.warn("Background incremental sync requires Google reconnect", {
          userId,
        });
      } else {
        console.error("Background incremental sync failed", { userId, error });
      }
      await setSyncError(db, userId, message).catch(() => {});
    }
  })();
}

export async function isSyncInProgress(db: Database, userId: string): Promise<boolean> {
  const state = await db.query.syncState.findFirst({
    where: eq(syncState.userId, userId),
  });

  if (!state) {
    return false;
  }

  const now = Date.now();
  const hasLiveLock =
    typeof state.lockUntil === "number" && Number.isFinite(state.lockUntil) && state.lockUntil > now;

  if (!hasLiveLock && state.phase && state.phase !== "error") {
    await db
      .update(syncState)
      .set({
        phase: null,
        progressCurrent: null,
        progressTotal: null,
        lockUntil: null,
      })
      .where(eq(syncState.userId, userId));
  }

  return hasLiveLock;
}
