import { and, desc, eq, isNull, lt, or, sql } from "drizzle-orm";
import type { Database } from "../../../db/client";
import { mailboxes, syncJobs } from "../../../db/schema";
import { type SyncJobErrorClass } from "../errors";
import type { SyncWindowMonths } from "./preferences";

const SYNC_LOCK_TTL_MS = 4 * 60_000;
const STALE_SYNC_JOB_MESSAGE = "Sync job stalled or timed out.";

export type SyncJobKind = "full" | "incremental";
export type SyncJobTrigger = "manual" | "scheduled" | "system";

function hasLiveLock(lockUntil: number | null | undefined, now = Date.now()) {
  return (
    typeof lockUntil === "number" &&
    Number.isFinite(lockUntil) &&
    lockUntil > now
  );
}

export async function getMailboxSyncPreferences(
  db: Database,
  mailboxId: number,
): Promise<{
  mailbox: typeof mailboxes.$inferSelect | null;
  syncWindowMonths: SyncWindowMonths | null;
  syncCutoffAt: number | null;
}> {
  const mailbox = await db.query.mailboxes.findFirst({
    where: eq(mailboxes.id, mailboxId),
  });
  return {
    mailbox: mailbox ?? null,
    syncWindowMonths:
      (mailbox?.syncWindowMonths as SyncWindowMonths | null) ?? null,
    syncCutoffAt: mailbox?.syncCutoffAt ?? null,
  };
}

export async function setMailboxSyncPreferences(
  db: Database,
  mailboxId: number,
  input: {
    syncWindowMonths: SyncWindowMonths | null;
    syncCutoffAt: number | null;
  },
): Promise<typeof mailboxes.$inferSelect | null> {
  const mailbox = await db.query.mailboxes.findFirst({
    where: eq(mailboxes.id, mailboxId),
  });
  if (!mailbox) return null;

  const now = Date.now();
  await db
    .update(mailboxes)
    .set({
      syncWindowMonths: input.syncWindowMonths,
      syncCutoffAt: input.syncCutoffAt,
      updatedAt: now,
    })
    .where(eq(mailboxes.id, mailbox.id));

  return {
    ...mailbox,
    syncWindowMonths: input.syncWindowMonths,
    syncCutoffAt: input.syncCutoffAt,
    updatedAt: now,
  };
}

export async function acquireMailboxSyncLock(
  db: Database,
  mailboxId: number,
): Promise<boolean> {
  const now = Date.now();
  const locked = await db
    .update(mailboxes)
    .set({
      lockUntil: now + SYNC_LOCK_TTL_MS,
      updatedAt: now,
    })
    .where(
      and(
        eq(mailboxes.id, mailboxId),
        or(isNull(mailboxes.lockUntil), lt(mailboxes.lockUntil, now)),
      ),
    )
    .returning({ id: mailboxes.id });

  return locked.length > 0;
}

export async function touchMailboxSyncLock(
  db: Database,
  mailboxId: number,
): Promise<boolean> {
  const now = Date.now();
  const gt = (col: typeof mailboxes.lockUntil, val: number) =>
    sql`${col} > ${val}`;

  const rows = await db
    .update(mailboxes)
    .set({
      lockUntil: now + SYNC_LOCK_TTL_MS,
      updatedAt: now,
    })
    .where(and(eq(mailboxes.id, mailboxId), gt(mailboxes.lockUntil, now)))
    .returning({ id: mailboxes.id });

  return rows.length > 0;
}

export async function releaseMailboxSyncLock(
  db: Database,
  mailboxId: number,
): Promise<void> {
  await db
    .update(mailboxes)
    .set({ lockUntil: null, updatedAt: Date.now() })
    .where(eq(mailboxes.id, mailboxId));
}

export async function persistMailboxHistoryState(
  db: Database,
  mailboxId: number,
  historyId: string | null,
): Promise<void> {
  if (!historyId) return;

  const mailbox = await db.query.mailboxes.findFirst({
    where: eq(mailboxes.id, mailboxId),
  });
  if (!mailbox) return;

  if (mailbox.historyId) {
    try {
      if (BigInt(historyId) <= BigInt(mailbox.historyId)) return;
    } catch {
    }
  }

  await db
    .update(mailboxes)
    .set({ historyId, updatedAt: Date.now() })
    .where(eq(mailboxes.id, mailboxId));
}

export async function resetMailboxSyncState(
  db: Database,
  mailboxId: number,
): Promise<void> {
  await db
    .update(mailboxes)
    .set({
      historyId: null,
      lastErrorAt: null,
      lastErrorMessage: null,
      lockUntil: null,
      updatedAt: Date.now(),
    })
    .where(eq(mailboxes.id, mailboxId));

  await db
    .update(syncJobs)
    .set({
      status: "failed",
      finishedAt: Date.now(),
      errorMessage: "Reset by user",
    })
    .where(
      and(eq(syncJobs.mailboxId, mailboxId), eq(syncJobs.status, "running")),
    );
}

export async function createSyncJob(
  db: Database,
  mailboxId: number,
  kind: SyncJobKind,
  trigger: SyncJobTrigger,
) {
  const now = Date.now();
  const rows = await db
    .insert(syncJobs)
    .values({
      id: crypto.randomUUID(),
      mailboxId,
      kind,
      trigger,
      status: "running",
      attempt: 1,
      startedAt: now,
      createdAt: now,
    })
    .returning();

  return rows[0];
}

export async function updateSyncJobProgress(
  db: Database,
  mailboxId: number,
  jobId: string,
  phase: string,
  current: number,
  total: number,
): Promise<void> {
  const now = Date.now();

  await db
    .update(syncJobs)
    .set({ phase, progressCurrent: current, progressTotal: total })
    .where(and(eq(syncJobs.id, jobId), eq(syncJobs.mailboxId, mailboxId)));

  await db
    .update(mailboxes)
    .set({ lockUntil: now + SYNC_LOCK_TTL_MS, updatedAt: now })
    .where(eq(mailboxes.id, mailboxId));
}

export async function markSyncJobSucceeded(
  db: Database,
  mailboxId: number,
  jobId: string,
): Promise<void> {
  const now = Date.now();

  await db
    .update(syncJobs)
    .set({ status: "succeeded", finishedAt: now })
    .where(and(eq(syncJobs.id, jobId), eq(syncJobs.mailboxId, mailboxId)));

  await db
    .update(mailboxes)
    .set({
      authState: "ok",
      lastSuccessfulSyncAt: now,
      lastErrorAt: null,
      lastErrorMessage: null,
      lockUntil: null,
      updatedAt: now,
    })
    .where(eq(mailboxes.id, mailboxId));
}

export async function markSyncJobFailed(
  db: Database,
  mailboxId: number,
  jobId: string,
  message: string,
  errorClass: SyncJobErrorClass,
): Promise<void> {
  const now = Date.now();
  const authState =
    errorClass === "reconnect_required" ? "reconnect_required" : "ok";

  await db
    .update(syncJobs)
    .set({
      status: "failed",
      finishedAt: now,
      errorClass,
      errorMessage: message,
    })
    .where(and(eq(syncJobs.id, jobId), eq(syncJobs.mailboxId, mailboxId)));

  await db
    .update(mailboxes)
    .set({
      authState,
      lastErrorAt: now,
      lastErrorMessage: message,
      lockUntil: null,
      updatedAt: now,
    })
    .where(eq(mailboxes.id, mailboxId));
}

async function expireStaleSyncJobs(
  db: Database,
  mailboxId: number,
): Promise<boolean> {
  const now = Date.now();
  const staleJobs = await db
    .update(syncJobs)
    .set({
      status: "failed",
      finishedAt: now,
      errorClass: "stale_lock",
      errorMessage: STALE_SYNC_JOB_MESSAGE,
    })
    .where(
      and(eq(syncJobs.mailboxId, mailboxId), eq(syncJobs.status, "running")),
    )
    .returning({ id: syncJobs.id });

  if (staleJobs.length === 0) return false;

  await db
    .update(mailboxes)
    .set({
      lastErrorAt: now,
      lastErrorMessage: STALE_SYNC_JOB_MESSAGE,
      lockUntil: null,
      updatedAt: now,
    })
    .where(eq(mailboxes.id, mailboxId));

  return true;
}

export async function countConsecutiveFailedJobs(
  db: Database,
  mailboxId: number,
): Promise<number> {
  const recentJobs = await db
    .select({ status: syncJobs.status, errorClass: syncJobs.errorClass })
    .from(syncJobs)
    .where(eq(syncJobs.mailboxId, mailboxId))
    .orderBy(desc(syncJobs.createdAt))
    .limit(10);

  let count = 0;
  for (const job of recentJobs) {
    if (job.status !== "failed") break;
    if (job.errorClass === "rate_limited") continue;
    count++;
  }
  return count;
}

export async function getMailboxSyncSnapshot(
  db: Database,
  mailboxId: number,
): Promise<{
  mailbox: typeof mailboxes.$inferSelect | null;
  latestJob: typeof syncJobs.$inferSelect | null;
  activeJob: typeof syncJobs.$inferSelect | null;
  hasLiveLock: boolean;
}> {
  let mailbox = await db.query.mailboxes.findFirst({
    where: eq(mailboxes.id, mailboxId),
  });
  if (!mailbox) {
    return {
      mailbox: null,
      latestJob: null,
      activeJob: null,
      hasLiveLock: false,
    };
  }

  let liveLock = hasLiveLock(mailbox.lockUntil);
  if (!liveLock) {
    const expired = await expireStaleSyncJobs(db, mailbox.id);
    if (expired) {
      mailbox =
        (await db.query.mailboxes.findFirst({
          where: eq(mailboxes.id, mailbox.id),
        })) ?? mailbox;
    }
  }

  liveLock = hasLiveLock(mailbox.lockUntil);

  const latestJobRows = await db
    .select()
    .from(syncJobs)
    .where(eq(syncJobs.mailboxId, mailbox.id))
    .orderBy(desc(syncJobs.createdAt))
    .limit(1);

  const activeJobRows = liveLock
    ? await db
        .select()
        .from(syncJobs)
        .where(
          and(
            eq(syncJobs.mailboxId, mailbox.id),
            eq(syncJobs.status, "running"),
          ),
        )
        .orderBy(desc(syncJobs.createdAt))
        .limit(1)
    : [];

  return {
    mailbox,
    latestJob: latestJobRows[0] ?? null,
    activeJob: activeJobRows[0] ?? null,
    hasLiveLock: liveLock,
  };
}
