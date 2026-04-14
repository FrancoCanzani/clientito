import { eq } from "drizzle-orm";
import type { Database } from "../../../db/client";
import { mailboxes } from "../../../db/schema";
import {
  MESSAGE_CHUNK_SIZE,
  fetchMessagesBatch,
  getCurrentHistoryId,
  getGmailTokenForMailbox,
  listHistoryPage,
  listMessagesPage,
} from "../client";
import {
  classifySyncError,
  createGmailSyncStateError,
  isGmailHistoryExpiredError,
  isGmailReconnectRequiredError,
} from "../errors";
import {
  acquireMailboxSyncLock,
  countConsecutiveFailedJobs,
  createSyncJob,
  getMailboxSyncPreferences,
  getMailboxSyncSnapshot,
  markSyncJobFailed,
  markSyncJobSucceeded,
  persistMailboxHistoryState,
  releaseMailboxSyncLock,
  resetMailboxSyncState,
  touchMailboxSyncLock,
  updateSyncJobProgress,
  type SyncJobKind,
  type SyncJobTrigger,
} from "../sync/state";
import { buildGmailQueryFromCutoff } from "./preferences";
import { chunkArray } from "../../utils";
import type {
  GmailHistoryResponse,
  GmailSyncResult,
  SyncProgressFn,
} from "../types";

const ON_DEMAND_SYNC_MIN_INTERVAL_MS = 60_000;
const RATE_LIMIT_COOLDOWN_MS = 5 * 60_000;
const ESCALATE_TO_FULL_SYNC_AFTER = 5;

function maxHistoryId(
  current: string | null,
  candidate?: string | null,
): string | null {
  if (!candidate) return current;
  if (!current) return candidate;

  try {
    return BigInt(candidate) > BigInt(current) ? candidate : current;
  } catch {
    return candidate;
  }
}

type ProcessMessagesInput = {
  accessToken: string;
  messageIds: string[];
  refreshExisting?: boolean;
  onProgress?: SyncProgressFn;
  onHeartbeat?: () => Promise<void> | Promise<boolean>;
  progressOffset?: number;
  progressTotal?: number;
  minDateMs?: number | null;
};

async function processMessageIds({
  accessToken,
  messageIds,
  refreshExisting = false,
  onProgress,
  onHeartbeat,
  progressOffset = 0,
  progressTotal,
  minDateMs,
}: ProcessMessagesInput): Promise<GmailSyncResult> {
  const result: GmailSyncResult = {
    processed: 0,
    inserted: 0,
    skipped: 0,
    historyId: null,
  };

  const total = progressTotal ?? messageIds.length;

  for (const chunk of chunkArray(messageIds, MESSAGE_CHUNK_SIZE)) {
    if (chunk.length === 0) continue;

    const format = refreshExisting ? "minimal" : "full";
    const batchResults = await fetchMessagesBatch(accessToken, chunk, format as "full" | "minimal");

    for (const messageId of chunk) {
      result.processed += 1;
      const message = batchResults.get(messageId) ?? null;

      if (!message) {
        result.skipped += 1;
        continue;
      }

      try {
        const internalDate = Number(message.internalDate ?? "");
        const normalizedInternalDate =
          Number.isFinite(internalDate) && internalDate > 0 ? internalDate : null;

        if (
          typeof minDateMs === "number" &&
          normalizedInternalDate !== null &&
          normalizedInternalDate < minDateMs
        ) {
          result.skipped += 1;
          result.historyId = maxHistoryId(result.historyId, message.historyId);
          continue;
        }

        if (!message.payload && !refreshExisting) {
          result.skipped += 1;
          result.historyId = maxHistoryId(result.historyId, message.historyId);
          continue;
        }

        result.inserted += 1;
        result.historyId = maxHistoryId(result.historyId, message.historyId);
      } catch (error) {
        result.skipped += 1;
        console.error("Failed to process Gmail message", { messageId: message.id, error });
      }
    }

    if (onProgress) {
      await onProgress("fetching", progressOffset + result.processed, total);
    }

    await onHeartbeat?.();
  }

  return result;
}

export type HistoryDelta = {
  changedMessageIds: string[];
  deletedMessageIds: string[];
};

type SyncExecutionOptions = {
  skipLock?: boolean;
  cutoffAt?: number | null;
};

export async function startFullGmailSync(
  db: Database,
  env: Env,
  mailboxId: number,
  _userId: string,
  onProgress?: SyncProgressFn,
  options?: SyncExecutionOptions,
): Promise<GmailSyncResult> {
  const hasLock =
    options?.skipLock === true ? true : await acquireMailboxSyncLock(db, mailboxId);
  if (!hasLock) {
    throw createGmailSyncStateError("Sync already in progress.");
  }

  try {
    const { syncCutoffAt } = await getMailboxSyncPreferences(db, mailboxId);
    const effectiveCutoffAt =
      options && "cutoffAt" in options ? options.cutoffAt ?? null : syncCutoffAt;
    const gmailQuery = buildGmailQueryFromCutoff(effectiveCutoffAt);
    const accessToken = await getGmailTokenForMailbox(db, mailboxId, {
      GOOGLE_CLIENT_ID: env.GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET: env.GOOGLE_CLIENT_SECRET,
    });

    const historyIdBeforeFullSync = await getCurrentHistoryId(accessToken);

    await onProgress?.("listing", 0, 0);
    const allMessageIds: string[] = [];
    let pageToken: string | undefined;

    do {
      const page = await listMessagesPage(accessToken, pageToken, gmailQuery);
      const ids = (page.messages ?? []).map((m) => m.id);
      allMessageIds.push(...ids);
      await onProgress?.("listing", allMessageIds.length, 0);
      pageToken = page.nextPageToken;
    } while (pageToken);

    console.log(`[full-sync] mailbox=${mailboxId} listed ${allMessageIds.length} messages, query=${gmailQuery ?? "all"}`);

    await onProgress?.("fetching", 0, allMessageIds.length);
    const result = await processMessageIds({
      accessToken,
      messageIds: allMessageIds,
      onProgress,
      onHeartbeat: () => touchMailboxSyncLock(db, mailboxId),
      progressOffset: 0,
      progressTotal: allMessageIds.length,
      minDateMs: effectiveCutoffAt,
    });

    if (historyIdBeforeFullSync) {
      await persistMailboxHistoryState(db, mailboxId, historyIdBeforeFullSync);
    }

    if (historyIdBeforeFullSync) {
      const deltaResult = await runIncrementalGmailSyncWithAccessToken({
        db,
        accessToken,
        mailboxId,
        startHistoryId: historyIdBeforeFullSync,
      });

      return {
        processed: result.processed + deltaResult.processed,
        inserted: result.inserted + deltaResult.inserted,
        skipped: result.skipped + deltaResult.skipped,
        historyId: deltaResult.historyId,
      };
    }

    const latestHistoryId =
      result.historyId ?? (await getCurrentHistoryId(accessToken));
    result.historyId = latestHistoryId;

    await persistMailboxHistoryState(db, mailboxId, latestHistoryId);
    console.log(`[full-sync] mailbox=${mailboxId} done: inserted=${result.inserted} skipped=${result.skipped}`);

    return result;
  } catch (error) {
    console.error(`[full-sync] mailbox=${mailboxId} failed`, error instanceof Error ? error.message : error);
    throw error;
  } finally {
    if (options?.skipLock !== true) {
      await releaseMailboxSyncLock(db, mailboxId);
    }
  }
}

export function extractHistoryDelta(
  history: GmailHistoryResponse["history"],
): HistoryDelta {
  const changedMessageIds = new Set<string>();
  const deletedMessageIds = new Set<string>();

  for (const entry of history ?? []) {
    for (const added of entry.messagesAdded ?? []) {
      const messageId = added.message?.id;
      if (messageId) changedMessageIds.add(messageId);
    }

    for (const labelsAdded of entry.labelsAdded ?? []) {
      const messageId = labelsAdded.message?.id;
      if (messageId) changedMessageIds.add(messageId);
    }

    for (const labelsRemoved of entry.labelsRemoved ?? []) {
      const messageId = labelsRemoved.message?.id;
      if (messageId) changedMessageIds.add(messageId);
    }

    for (const deleted of entry.messagesDeleted ?? []) {
      const messageId = deleted.message?.id;
      if (messageId) deletedMessageIds.add(messageId);
    }
  }

  for (const deletedMessageId of deletedMessageIds) {
    changedMessageIds.delete(deletedMessageId);
  }

  return {
    changedMessageIds: [...changedMessageIds],
    deletedMessageIds: [...deletedMessageIds],
  };
}

type IncrementalSyncCoreInput = {
  db: Database;
  accessToken: string;
  mailboxId: number;
  startHistoryId: string;
};

async function runIncrementalGmailSyncWithAccessToken({
  db,
  accessToken,
  mailboxId,
  startHistoryId,
}: IncrementalSyncCoreInput): Promise<GmailSyncResult> {
  const { syncCutoffAt } = await getMailboxSyncPreferences(db, mailboxId);
  let pageToken: string | undefined;
  let latestHistoryId: string | null = startHistoryId;
  const seenChangedMessageIds = new Set<string>();
  const seenDeletedMessageIds = new Set<string>();
  const aggregate: GmailSyncResult = {
    processed: 0,
    inserted: 0,
    skipped: 0,
    historyId: null,
  };
  const heartbeat = () => touchMailboxSyncLock(db, mailboxId);

  do {
    await heartbeat();
    const page = await listHistoryPage(accessToken, startHistoryId, pageToken);
    latestHistoryId = maxHistoryId(latestHistoryId, page.historyId);

    for (const entry of page.history ?? []) {
      latestHistoryId = maxHistoryId(latestHistoryId, entry.id);
    }

    const historyDelta = extractHistoryDelta(page.history);
    const pageDeletedMessageIds = historyDelta.deletedMessageIds.filter((id) => {
      if (seenDeletedMessageIds.has(id)) return false;
      seenDeletedMessageIds.add(id);
      return true;
    });
    const pageChangedMessageIds = historyDelta.changedMessageIds.filter((id) => {
      if (seenChangedMessageIds.has(id) || seenDeletedMessageIds.has(id)) return false;
      seenChangedMessageIds.add(id);
      return true;
    });

    aggregate.processed += pageDeletedMessageIds.length;

    const pageResult = await processMessageIds({
      accessToken,
      messageIds: pageChangedMessageIds,
      refreshExisting: true,
      onHeartbeat: heartbeat,
      minDateMs: syncCutoffAt,
    });

    aggregate.processed += pageResult.processed;
    aggregate.inserted += pageResult.inserted;
    aggregate.skipped += pageResult.skipped;
    latestHistoryId = maxHistoryId(latestHistoryId, pageResult.historyId);
    pageToken = page.nextPageToken;
  } while (pageToken);

  if (!latestHistoryId) {
    latestHistoryId = await getCurrentHistoryId(accessToken);
  }

  aggregate.historyId = latestHistoryId;
  await persistMailboxHistoryState(db, mailboxId, latestHistoryId);

  return aggregate;
}

async function runIncrementalGmailSync(
  db: Database,
  env: Env,
  mailboxId: number,
  _userId: string,
  startHistoryIdInput?: string | null,
  options?: SyncExecutionOptions,
): Promise<GmailSyncResult> {
  const hasLock =
    options?.skipLock === true ? true : await acquireMailboxSyncLock(db, mailboxId);
  if (!hasLock) {
    throw createGmailSyncStateError("Sync already in progress.");
  }

  try {
    const mailbox = await db.query.mailboxes.findFirst({
      where: eq(mailboxes.id, mailboxId),
    });
    const startHistoryId = startHistoryIdInput ?? mailbox?.historyId ?? null;
    if (!startHistoryId) {
      throw createGmailSyncStateError("No sync state found. Run full sync first.");
    }

    const accessToken = await getGmailTokenForMailbox(db, mailboxId, {
      GOOGLE_CLIENT_ID: env.GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET: env.GOOGLE_CLIENT_SECRET,
    });

    return await runIncrementalGmailSyncWithAccessToken({
      db,
      accessToken,
      mailboxId,
      startHistoryId,
    });
  } finally {
    if (options?.skipLock !== true) {
      await releaseMailboxSyncLock(db, mailboxId);
    }
  }
}

async function withSyncJob(
  db: Database,
  mailboxId: number,
  userId: string,
  kind: SyncJobKind,
  trigger: SyncJobTrigger,
  fn: (mailboxId: number, jobId: string) => Promise<GmailSyncResult>,
): Promise<{ status: "completed"; result: GmailSyncResult } | { status: "failed"; error: string }> {
  const hasLock = await acquireMailboxSyncLock(db, mailboxId);
  if (!hasLock) return { status: "failed", error: "Sync already in progress" };

  const job = await createSyncJob(db, mailboxId, kind, trigger);

  try {
    const result = await fn(mailboxId, job.id);
    await markSyncJobSucceeded(db, mailboxId, job.id);
    return { status: "completed", result };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sync failed";
    if (isGmailReconnectRequiredError(error)) {
      console.warn(`${kind} sync requires Google reconnect`, { userId, mailboxId });
    } else {
      console.error(`${kind} sync failed`, { userId, mailboxId, error });
    }
    await markSyncJobFailed(
      db, mailboxId, job.id, message, classifySyncError(error),
    ).catch((e) => console.error("Failed to mark sync job as failed", { mailboxId, error: e }));
    return { status: "failed", error: message };
  } finally {
    await releaseMailboxSyncLock(db, mailboxId).catch((e) => console.error("Failed to release sync lock", { mailboxId, error: e }));
  }
}

export async function catchUpMailboxOnDemand(
  db: Database,
  env: Env,
  mailboxId: number,
  userId: string,
  options?: {
    minIntervalMs?: number;
    force?: boolean;
  },
): Promise<
  | { status: "completed"; result: GmailSyncResult }
  | {
      status: "skipped";
      reason:
        | "needs_full_sync"
        | "reconnect_required"
        | "sync_in_progress"
        | "rate_limited_cooldown"
        | "recently_synced";
    }
  | { status: "failed"; error: string }
> {
  const snapshot = await getMailboxSyncSnapshot(db, mailboxId);
  const mailbox = snapshot.mailbox;

  if (!mailbox?.historyId) {
    return { status: "skipped", reason: "needs_full_sync" };
  }

  if (mailbox.authState === "reconnect_required") {
    return { status: "skipped", reason: "reconnect_required" };
  }

  if (snapshot.hasLiveLock) {
    return { status: "skipped", reason: "sync_in_progress" };
  }

  if (
    options?.force !== true &&
    snapshot.latestJob?.status === "failed" &&
    snapshot.latestJob.errorClass === "rate_limited" &&
    typeof snapshot.latestJob.finishedAt === "number" &&
    snapshot.latestJob.finishedAt + RATE_LIMIT_COOLDOWN_MS > Date.now()
  ) {
    const retryAfterMs =
      snapshot.latestJob.finishedAt + RATE_LIMIT_COOLDOWN_MS - Date.now();
    console.warn("Skipping incremental sync during Gmail rate-limit cooldown", {
      userId,
      mailboxId,
      retryAfterMs: Math.max(0, retryAfterMs),
    });
    return { status: "skipped", reason: "rate_limited_cooldown" };
  }

  const minIntervalMs = options?.minIntervalMs ?? ON_DEMAND_SYNC_MIN_INTERVAL_MS;
  if (
    options?.force !== true &&
    mailbox.lastSuccessfulSyncAt !== null &&
    mailbox.lastSuccessfulSyncAt + minIntervalMs > Date.now()
  ) {
    return { status: "skipped", reason: "recently_synced" };
  }

  const consecutiveFailures = await countConsecutiveFailedJobs(db, mailbox.id);
  const shouldEscalate = consecutiveFailures >= ESCALATE_TO_FULL_SYNC_AFTER;

  if (shouldEscalate) {
    console.warn("Escalating to full sync after consecutive failures", {
      userId,
      mailboxId,
      consecutiveFailures,
    });
    return withSyncJob(db, mailboxId, userId, "full", "system", async () => {
      return startFullGmailSync(
        db, env, mailboxId, userId, undefined, { skipLock: true },
      );
    });
  }

  return withSyncJob(db, mailboxId, userId, "incremental", "system", async () => {
    try {
      return await runIncrementalGmailSync(
        db, env, mailboxId, userId, mailbox.historyId, { skipLock: true },
      );
    } catch (error) {
      if (isGmailHistoryExpiredError(error)) {
        console.warn("History expired, falling back to full sync", { userId, mailboxId });
        return startFullGmailSync(
          db, env, mailboxId, userId, undefined, { skipLock: true },
        );
      }
      throw error;
    }
  });
}

export async function recoverMailboxSync(
  db: Database,
  env: Env,
  mailboxId: number,
  userId: string,
): Promise<void> {
  await resetMailboxSyncState(db, mailboxId);

  await withSyncJob(db, mailboxId, userId, "full", "manual", async (_mbId, jobId) => {
    return startFullGmailSync(
      db, env, mailboxId, userId,
      (phase, current, total) =>
        updateSyncJobProgress(db, mailboxId, jobId, phase, current, total),
      { skipLock: true },
    );
  });
}
