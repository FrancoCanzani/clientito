import type { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import type { Database } from "../../db/client";
import { syncState } from "../../db/schema";
import { isGmailReconnectRequiredError } from "../../lib/gmail/errors";
import {
  runIncrementalGmailSync,
  startFullGmailSync,
} from "../../lib/gmail/sync";
import type { AppRouteEnv } from "../types";
import { syncRequestSchema } from "./schemas";

const SYNC_PROGRESS_LOCK_TTL_MS = 4 * 60_000;

function monthsToGmailQuery(months?: number): string | undefined {
  if (!months) return undefined;
  const after = new Date();
  after.setMonth(after.getMonth() - months);
  const y = after.getFullYear();
  const m = String(after.getMonth() + 1).padStart(2, "0");
  const d = String(after.getDate()).padStart(2, "0");
  return `after:${y}/${m}/${d}`;
}

async function updateSyncProgress(
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

async function clearSyncProgress(db: Database, userId: string) {
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

async function setSyncError(db: Database, userId: string, message: string) {
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

async function isSyncInProgress(db: Database, userId: string): Promise<boolean> {
  const state = await db.query.syncState.findFirst({
    where: eq(syncState.userId, userId),
  });

  if (!state) return false;

  const now = Date.now();
  const hasLiveLock =
    typeof state.lockUntil === "number" && Number.isFinite(state.lockUntil) && state.lockUntil > now;

  if (!hasLiveLock && state.phase && state.phase !== "error") {
    await clearSyncProgress(db, userId);
  }

  return hasLiveLock;
}

function runFullSyncInBackground(
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

function runIncrementalSyncInBackground(
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

export function registerPostSync(api: Hono<AppRouteEnv>) {
  api.post("/start", zValidator("json", syncRequestSchema), async (c) => {
    const db = c.get("db");
    const user = c.get("user")!;

    const { months, continueFullSync } = c.req.valid("json");
    if (await isSyncInProgress(db, user.id)) {
      return c.json({ error: "Sync already in progress" }, 409);
    }

    c.executionCtx.waitUntil(
      runFullSyncInBackground(db, c.env, user.id, months, continueFullSync),
    );
    return c.json({ data: { status: "started" } }, 202);
  });

  api.post("/incremental", zValidator("json", syncRequestSchema), async (c) => {
    const db = c.get("db");
    const user = c.get("user")!;

    c.req.valid("json");
    if (await isSyncInProgress(db, user.id)) {
      return c.json({ error: "Sync already in progress" }, 409);
    }

    c.executionCtx.waitUntil(runIncrementalSyncInBackground(db, c.env, user.id));
    return c.json({ data: { status: "started" } }, 202);
  });
}
