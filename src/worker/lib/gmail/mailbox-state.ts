import { and, desc, eq, isNull, lt, or, sql } from "drizzle-orm";
import type { Database } from "../../db/client";
import { mailboxes, syncJobs } from "../../db/schema";
import { GOOGLE_RECONNECT_REQUIRED_MESSAGE } from "./errors";

export const SYNC_LOCK_TTL_MS = 4 * 60_000;
const STALE_SYNC_JOB_MESSAGE = "Sync job stalled or timed out.";

export type SyncJobKind = "full" | "incremental";
export type SyncJobTrigger = "manual" | "scheduled" | "system";
export type SyncJobErrorClass =
  | "reconnect_required"
  | "history_expired"
  | "state_error"
  | "stale_lock"
  | "sync_failed";

function hasLiveLock(lockUntil: number | null | undefined, now = Date.now()) {
  return (
    typeof lockUntil === "number" &&
    Number.isFinite(lockUntil) &&
    lockUntil > now
  );
}

async function findMailbox(db: Database, userId: string) {
  return db.query.mailboxes.findFirst({
    where: eq(mailboxes.userId, userId),
  });
}

export async function ensureMailbox(
  db: Database,
  userId: string,
  gmailEmail?: string | null,
) {
  const existing = await findMailbox(db, userId);

  if (existing) {
    if (gmailEmail && existing.gmailEmail !== gmailEmail) {
      await db
        .update(mailboxes)
        .set({
          gmailEmail,
          updatedAt: Date.now(),
        })
        .where(eq(mailboxes.id, existing.id));
      return {
        ...existing,
        gmailEmail,
      };
    }

    return existing;
  }

  const now = Date.now();
  const inserted = await db
    .insert(mailboxes)
    .values({
      userId,
      gmailEmail: gmailEmail ?? null,
      authState: "unknown",
      updatedAt: now,
    })
    .onConflictDoNothing({ target: mailboxes.userId })
    .returning();

  return (
    inserted[0] ??
    (await db.query.mailboxes.findFirst({
      where: eq(mailboxes.userId, userId),
    }))
  );
}

export async function acquireMailboxSyncLock(
  db: Database,
  userId: string,
  gmailEmail?: string | null,
): Promise<boolean> {
  await ensureMailbox(db, userId, gmailEmail);

  const now = Date.now();
  const locked = await db
    .update(mailboxes)
    .set({
      lockUntil: now + SYNC_LOCK_TTL_MS,
      updatedAt: now,
    })
    .where(
      and(
        eq(mailboxes.userId, userId),
        or(isNull(mailboxes.lockUntil), lt(mailboxes.lockUntil, now)),
      ),
    )
    .returning({ id: mailboxes.id });

  return locked.length > 0;
}

export async function touchMailboxSyncLock(
  db: Database,
  userId: string,
): Promise<boolean> {
  const now = Date.now();
  const gt = (col: typeof mailboxes.lockUntil, val: number) => sql`${col} > ${val}`;

  const rows = await db
    .update(mailboxes)
    .set({
      lockUntil: now + SYNC_LOCK_TTL_MS,
      updatedAt: now,
    })
    .where(
      and(
        eq(mailboxes.userId, userId),
        gt(mailboxes.lockUntil, now),
      ),
    )
    .returning({ id: mailboxes.id });

  return rows.length > 0;
}

export async function releaseMailboxSyncLock(
  db: Database,
  userId: string,
): Promise<void> {
  await db
    .update(mailboxes)
    .set({
      lockUntil: null,
      updatedAt: Date.now(),
    })
    .where(eq(mailboxes.userId, userId));
}

export async function persistMailboxHistoryState(
  db: Database,
  userId: string,
  historyId: string | null,
): Promise<void> {
  await ensureMailbox(db, userId);
  await db
    .update(mailboxes)
    .set({
      historyId,
      updatedAt: Date.now(),
    })
    .where(eq(mailboxes.userId, userId));
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
    .set({
      phase,
      progressCurrent: current,
      progressTotal: total,
    })
    .where(and(eq(syncJobs.id, jobId), eq(syncJobs.mailboxId, mailboxId)));

  await db
    .update(mailboxes)
    .set({
      lockUntil: now + SYNC_LOCK_TTL_MS,
      updatedAt: now,
    })
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
    .set({
      status: "succeeded",
      finishedAt: now,
    })
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

export async function markMailboxReconnectRequired(
  db: Database,
  userId: string,
  message = GOOGLE_RECONNECT_REQUIRED_MESSAGE,
): Promise<void> {
  await ensureMailbox(db, userId);
  await db
    .update(mailboxes)
    .set({
      authState: "reconnect_required",
      lastErrorAt: Date.now(),
      lastErrorMessage: message,
      lockUntil: null,
      updatedAt: Date.now(),
    })
    .where(eq(mailboxes.userId, userId));
}

export async function expireStaleSyncJobs(
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
    .where(and(eq(syncJobs.mailboxId, mailboxId), eq(syncJobs.status, "running")))
    .returning({ id: syncJobs.id });

  if (staleJobs.length === 0) {
    return false;
  }

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

export async function getMailboxSyncSnapshot(
  db: Database,
  userId: string,
): Promise<{
  mailbox: typeof mailboxes.$inferSelect | null;
  latestJob: typeof syncJobs.$inferSelect | null;
  activeJob: typeof syncJobs.$inferSelect | null;
  hasLiveLock: boolean;
}> {
  let mailbox = await findMailbox(db, userId);

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

  if (!mailbox) {
    return {
      mailbox: null,
      latestJob: null,
      activeJob: null,
      hasLiveLock: false,
    };
  }

  liveLock = hasLiveLock(mailbox?.lockUntil);

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
          and(eq(syncJobs.mailboxId, mailbox.id), eq(syncJobs.status, "running")),
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
