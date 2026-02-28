import { eq } from "drizzle-orm";
import type { Database } from "../../db/client";
import { syncState } from "../../db/schema";
import {
  isGmailReconnectRequiredError,
  runIncrementalGmailSync,
  startFullGmailSync,
} from "../../lib/gmail";
import { monthsToGmailQuery } from "./helpers";

export async function updateSyncProgress(
  db: Database,
  orgId: string,
  phase: string,
  current: number,
  total: number,
) {
  await db
    .update(syncState)
    .set({ phase, progressCurrent: current, progressTotal: total, error: null })
    .where(eq(syncState.orgId, orgId));
}

export async function clearSyncProgress(db: Database, orgId: string) {
  await db
    .update(syncState)
    .set({ phase: null, progressCurrent: null, progressTotal: null })
    .where(eq(syncState.orgId, orgId));
}

export async function setSyncError(db: Database, orgId: string, message: string) {
  await db
    .update(syncState)
    .set({ phase: "error", progressCurrent: null, progressTotal: null, error: message })
    .where(eq(syncState.orgId, orgId));
}

export function runFullSyncInBackground(
  db: Database,
  env: Env,
  orgId: string,
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
        orgId,
        userId,
        (phase, current, total) => updateSyncProgress(db, orgId, phase, current, total),
        gmailQuery,
      );

      if (shouldRunFollowUpFullSync) {
        await startFullGmailSync(
          db,
          env,
          orgId,
          userId,
          (phase, current, total) => updateSyncProgress(db, orgId, phase, current, total),
        );
      }

      await clearSyncProgress(db, orgId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Sync failed";
      if (isGmailReconnectRequiredError(error)) {
        console.warn("Background full sync requires Google reconnect", { orgId });
      } else {
        console.error("Background full sync failed", { orgId, error });
      }
      await setSyncError(db, orgId, message).catch(() => {});
    }
  })();
}

export function runIncrementalSyncInBackground(
  db: Database,
  env: Env,
  orgId: string,
  userId: string,
) {
  return (async () => {
    try {
      await updateSyncProgress(db, orgId, "syncing", 0, 0);
      await runIncrementalGmailSync(db, env, orgId, userId);

      await clearSyncProgress(db, orgId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Sync failed";
      if (isGmailReconnectRequiredError(error)) {
        console.warn("Background incremental sync requires Google reconnect", {
          orgId,
        });
      } else {
        console.error("Background incremental sync failed", { orgId, error });
      }
      await setSyncError(db, orgId, message).catch(() => {});
    }
  })();
}

export async function isSyncInProgress(db: Database, orgId: string): Promise<boolean> {
  const state = await db.query.syncState.findFirst({
    where: eq(syncState.orgId, orgId),
  });

  return Boolean(state?.phase && state.phase !== "error");
}
