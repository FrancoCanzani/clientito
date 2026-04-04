import { and, eq, inArray } from "drizzle-orm";
import type { Database } from "../../../../db/client";
import { emails, mailboxes } from "../../../../db/schema";
import { parseParticipants } from "../../participants";
import {
  normalizeUnsubscribeEmail,
  normalizeUnsubscribeUrl,
  syncEmailSubscriptions,
} from "../../subscriptions";
import {
  MESSAGE_CHUNK_SIZE,
  fetchMessage,
  fetchMessagesBatch,
  getCurrentHistoryId,
  getGmailTokenForMailbox,
  listHistoryPage,
  listMessagesPage,

} from "./client";
import {
  GmailHistoryExpiredError,
  GmailSyncStateError,
  classifySyncError,
  isGmailReconnectRequiredError,
} from "./errors";
import {
  acquireMailboxSyncLock,
  countConsecutiveFailedJobs,
  createSyncJob,
  getMailboxSyncPreferences,
  getMailboxSyncSnapshot,
  getUserMailboxes,
  markSyncJobFailed,
  markSyncJobSucceeded,
  persistMailboxHistoryState,
  releaseMailboxSyncLock,
  resetMailboxSyncState,
  touchMailboxSyncLock,
  updateSyncJobProgress,
  type SyncJobKind,
  type SyncJobTrigger,
} from "./mailbox-state";
import { buildGmailQueryFromCutoff } from "./sync-preferences";
import {
  extractMessageAttachments,
  extractMessageBodyHtml,
  extractMessageBodyText,
  getHeaderValue,
} from "./mailbox";
import { chunkArray } from "../../../utils";
import type {
  GmailHistoryResponse,
  GmailSyncResult,
  SyncProgressFn,
} from "./types";
import {
  enqueueEmailIntelligence,
  processInlineEmailIntelligence,
} from "../../intelligence/triage";
import { STANDARD_LABELS } from "../../types";

const HAS_ATTACHMENT_LABEL = "HAS_ATTACHMENT";
const ON_DEMAND_SYNC_MIN_INTERVAL_MS = 60_000;
const DB_INSERT_CHUNK_SIZE = 5;
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

function extractAddress(headerValue: string | null): string {
  if (!headerValue) return "";

  const match = headerValue.match(/<([^>]+)>/);
  return (match?.[1] ?? headerValue).trim();
}

type ProcessMessagesInput = {
  db: Database;
  accessToken: string;
  userId: string;
  mailboxId: number;
  messageIds: string[];
  env?: Env;
  refreshExisting?: boolean;
  onProgress?: SyncProgressFn;
  onHeartbeat?: () => Promise<void> | Promise<boolean>;
  progressOffset?: number;
  progressTotal?: number;
  minDateMs?: number | null;
  /** Skip inline AI triage during bulk imports — the cron will handle it. */
  skipInlineIntelligence?: boolean;
};

async function processMessageIds({
  db,
  accessToken,
  userId,
  mailboxId,
  messageIds,
  env,
  refreshExisting = false,
  onProgress,
  onHeartbeat,
  progressOffset = 0,
  progressTotal,
  minDateMs,
  skipInlineIntelligence = false,
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

    const existingRows = await db
      .select({ id: emails.id, providerMessageId: emails.providerMessageId, labelIds: emails.labelIds })
      .from(emails)
      .where(inArray(emails.providerMessageId, chunk));

    const existingByMessageId = new Map(
      existingRows.map((row) => [row.providerMessageId, row]),
    );
    const messageIdsToFetch = refreshExisting
      ? chunk
      : chunk.filter((id) => !existingByMessageId.has(id));

    if (!refreshExisting) {
      result.skipped += chunk.length - messageIdsToFetch.length;
      result.processed += chunk.length - messageIdsToFetch.length;
    }

    const format = refreshExisting ? "minimal" : "full";
    const batchResults = await fetchMessagesBatch(accessToken, messageIdsToFetch, format as "full" | "minimal");

    const pendingInserts: Array<typeof emails.$inferInsert> = [];
    const intelligenceCandidateMessageIds: string[] = [];
    const subscriptionEvents: Array<{
      fromAddr: string;
      fromName: string | null;
      unsubscribeUrl: string | null;
      unsubscribeEmail: string | null;
      receivedAt: number;
      emailCountDelta: number;
    }> = [];

    for (const messageId of messageIdsToFetch) {
      result.processed += 1;
      let message = batchResults.get(messageId) ?? null;
      const existingRow = existingByMessageId.get(messageId);

      if (!message) {
        if (refreshExisting && existingRow) {
          await db
            .delete(emails)
            .where(
              and(eq(emails.userId, userId), eq(emails.providerMessageId, messageId)),
            );
        }
        result.skipped += 1;
        continue;
      }

      try {
        const existingEmailId = existingRow?.id ?? null;
        const existingLabelIds = existingRow?.labelIds ?? [];
        const internalDate = Number(message.internalDate ?? "");
        const normalizedInternalDate =
          Number.isFinite(internalDate) && internalDate > 0 ? internalDate : null;

        if (
          typeof minDateMs === "number" &&
          normalizedInternalDate !== null &&
          normalizedInternalDate < minDateMs
        ) {
          if (existingEmailId && refreshExisting) {
            await db
              .delete(emails)
              .where(and(eq(emails.userId, userId), eq(emails.id, existingEmailId)));
          }
          result.skipped += 1;
          result.historyId = maxHistoryId(result.historyId, message.historyId);
          continue;
        }

        const minimalLabelIds = [...(message.labelIds ?? [])];
        if (
          existingLabelIds.includes(HAS_ATTACHMENT_LABEL) &&
          !minimalLabelIds.includes(HAS_ATTACHMENT_LABEL)
        ) {
          minimalLabelIds.push(HAS_ATTACHMENT_LABEL);
        }

        if (!message.payload) {
          if (existingEmailId && refreshExisting) {
            await db
              .update(emails)
              .set({
                threadId: message.threadId ?? null,
                date: Number(message.internalDate ?? "") || undefined,
                isRead: !minimalLabelIds.includes(STANDARD_LABELS.UNREAD),
                labelIds: minimalLabelIds,
              })
              .where(eq(emails.id, existingEmailId));
            result.historyId = maxHistoryId(result.historyId, message.historyId);
            continue;
          }

          // New message fetched in minimal format — re-fetch in full to get headers/body
          if (message.id) {
            try {
              message = await fetchMessage(accessToken, message.id, "full");
            } catch {
              result.skipped += 1;
              continue;
            }
          } else {
            result.skipped += 1;
            continue;
          }
        }

        const rawFrom = getHeaderValue(message.payload?.headers, "From");
        const rawTo = getHeaderValue(message.payload?.headers, "To");
        const rawCc = getHeaderValue(message.payload?.headers, "Cc");
        const rawMessageId = getHeaderValue(message.payload?.headers, "Message-ID");
        const fromAddr = extractAddress(rawFrom);
        const toAddr = extractAddress(rawTo);

        if (!fromAddr) {
          result.skipped += 1;
          continue;
        }

        const subject = getHeaderValue(message.payload?.headers, "Subject");
        const bodyText = extractMessageBodyText(message);
        const bodyHtml = extractMessageBodyHtml(message);
        const labelIds = [...(message.labelIds ?? [])];
        const hasAttachments = extractMessageAttachments(message).length > 0;
        if (hasAttachments && !labelIds.includes(HAS_ATTACHMENT_LABEL)) {
          labelIds.push(HAS_ATTACHMENT_LABEL);
        }
        const isRead = !labelIds.includes(STANDARD_LABELS.UNREAD);
        const date =
          normalizedInternalDate !== null
            ? normalizedInternalDate
            : Date.now();

        if (typeof minDateMs === "number" && date < minDateMs) {
          if (existingEmailId && refreshExisting) {
            await db
              .delete(emails)
              .where(and(eq(emails.userId, userId), eq(emails.id, existingEmailId)));
          }
          result.skipped += 1;
          result.historyId = maxHistoryId(result.historyId, message.historyId);
          continue;
        }

        const isSent = labelIds.includes(STANDARD_LABELS.SENT);
        const direction: "sent" | "received" = isSent ? "sent" : "received";

        const fromParticipants = parseParticipants(rawFrom);
        const senderParticipant =
          fromParticipants.find(
            (participant) => participant.email === fromAddr.toLowerCase(),
          ) ??
          fromParticipants[0] ??
          null;
        const fromName = senderParticipant?.name ?? null;
        const rawUnsubscribe = getHeaderValue(message.payload?.headers, "List-Unsubscribe");
        let unsubscribeUrl: string | null = null;
        let unsubscribeEmail: string | null = null;
        if (rawUnsubscribe) {
          const urls =
            rawUnsubscribe.match(/<([^>]+)>/g)?.map((m) => m.slice(1, -1)) ?? [];
          unsubscribeUrl = normalizeUnsubscribeUrl(
            urls.find((u) => u.startsWith("http")) ?? null,
          );
          unsubscribeEmail = normalizeUnsubscribeEmail(
            urls.find((u) => u.startsWith("mailto:")) ?? null,
          );
        }

        const emailValues = {
          threadId: message.threadId ?? null,
          messageId: rawMessageId ?? null,
          fromAddr,
          fromName,
          toAddr: toAddr || null,
          ccAddr: rawCc || null,
          subject,
          snippet: message.snippet ?? null,
          bodyText: bodyText || null,
          bodyHtml: bodyHtml || null,
          date,
          direction,
          isRead,
          labelIds,
          unsubscribeUrl,
          unsubscribeEmail,
        };

        if (
          direction === "received" &&
          (unsubscribeUrl || unsubscribeEmail)
        ) {
          subscriptionEvents.push({
            fromAddr,
            fromName,
            unsubscribeUrl,
            unsubscribeEmail,
            receivedAt: date,
            emailCountDelta: existingEmailId ? 0 : 1,
          });
        }

        if (existingEmailId) {
          await db
            .update(emails)
            .set(emailValues)
            .where(eq(emails.id, existingEmailId));
          if (direction === "received") {
            intelligenceCandidateMessageIds.push(message.id!);
          }
        } else {
          pendingInserts.push({
            userId,
            mailboxId,
            providerMessageId: message.id,
            ...emailValues,
            createdAt: Date.now(),
          });
          if (direction === "received") {
            intelligenceCandidateMessageIds.push(message.id!);
          }
          result.inserted += 1;
        }

        result.historyId = maxHistoryId(result.historyId, message.historyId);
      } catch (error) {
        result.skipped += 1;
        console.error("Failed to store Gmail message", { messageId: message.id, error });
      }
    }

    if (pendingInserts.length > 0) {
      for (const insertChunk of chunkArray(pendingInserts, DB_INSERT_CHUNK_SIZE)) {
        await db.insert(emails).values(insertChunk).onConflictDoNothing({ target: emails.providerMessageId });
      }
    }

    if (intelligenceCandidateMessageIds.length > 0) {
      try {
        const candidateRows = await db
          .select({ id: emails.id })
          .from(emails)
          .where(
            and(
              eq(emails.userId, userId),
              inArray(
                emails.providerMessageId,
                [...new Set(intelligenceCandidateMessageIds)],
              ),
            ),
          );

        const intelligenceEmailIds = await enqueueEmailIntelligence(
          db,
          candidateRows.map((row) => row.id),
        );

        if (env && intelligenceEmailIds.length > 0 && !skipInlineIntelligence) {
          await processInlineEmailIntelligence(db, env, intelligenceEmailIds);
        }
      } catch (error) {
        console.error("Email intelligence enqueue failed, skipping", error);
      }
    }

    await syncEmailSubscriptions(db, userId, mailboxId, subscriptionEvents);

    if (onProgress) {
      await onProgress("fetching", progressOffset + result.processed, total);
    }

    await onHeartbeat?.();
  }

  return result;
}

type HistoryDelta = {
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
  userId: string,
  onProgress?: SyncProgressFn,
  options?: SyncExecutionOptions,
): Promise<GmailSyncResult> {
  const hasLock =
    options?.skipLock === true ? true : await acquireMailboxSyncLock(db, mailboxId);
  if (!hasLock) {
    throw new GmailSyncStateError("Sync already in progress.");
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
      db,
      accessToken,
      userId,
      mailboxId,
      messageIds: allMessageIds,
      env,
      onProgress,
      onHeartbeat: () => touchMailboxSyncLock(db, mailboxId),
      progressOffset: 0,
      progressTotal: allMessageIds.length,
      minDateMs: effectiveCutoffAt,
      skipInlineIntelligence: true,
    });

    if (historyIdBeforeFullSync) {
      await persistMailboxHistoryState(db, mailboxId, historyIdBeforeFullSync);
    }

    if (historyIdBeforeFullSync) {
      const deltaResult = await runIncrementalGmailSyncWithAccessToken({
        db,
        accessToken,
        userId,
        mailboxId,
        startHistoryId: historyIdBeforeFullSync,
        env,
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

function extractHistoryDelta(
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

async function deleteMessagesByProviderIds(
  db: Database,
  userId: string,
  messageIds: string[],
): Promise<void> {
  if (messageIds.length === 0) return;

  await db
    .delete(emails)
    .where(and(eq(emails.userId, userId), inArray(emails.providerMessageId, messageIds)));
}

type IncrementalSyncCoreInput = {
  db: Database;
  accessToken: string;
  userId: string;
  mailboxId: number;
  startHistoryId: string;
  env?: Env;
};

async function runIncrementalGmailSyncWithAccessToken({
  db,
  accessToken,
  userId,
  mailboxId,
  startHistoryId,
  env,
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

    await deleteMessagesByProviderIds(db, userId, pageDeletedMessageIds);
    aggregate.processed += pageDeletedMessageIds.length;

    const pageResult = await processMessageIds({
      db,
      accessToken,
      userId,
      mailboxId,
      messageIds: pageChangedMessageIds,
      env,
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
  userId: string,
  startHistoryIdInput?: string | null,
  options?: SyncExecutionOptions,
): Promise<GmailSyncResult> {
  const hasLock =
    options?.skipLock === true ? true : await acquireMailboxSyncLock(db, mailboxId);
  if (!hasLock) {
    throw new GmailSyncStateError("Sync already in progress.");
  }

  try {
    const mailbox = await db.query.mailboxes.findFirst({
      where: eq(mailboxes.id, mailboxId),
    });
    const startHistoryId = startHistoryIdInput ?? mailbox?.historyId ?? null;
    if (!startHistoryId) {
      throw new GmailSyncStateError("No sync state found. Run full sync first.");
    }

    const accessToken = await getGmailTokenForMailbox(db, mailboxId, {
      GOOGLE_CLIENT_ID: env.GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET: env.GOOGLE_CLIENT_SECRET,
    });

    return await runIncrementalGmailSyncWithAccessToken({
      db,
      accessToken,
      userId,
      mailboxId,
      startHistoryId,
      env,
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
      if (error instanceof GmailHistoryExpiredError) {
        console.warn("History expired, falling back to full sync", { userId, mailboxId });
        return startFullGmailSync(
          db, env, mailboxId, userId, undefined, { skipLock: true },
        );
      }
      throw error;
    }
  });
}

/** Catch up all mailboxes for a user. Returns when all are done. */
export async function catchUpAllMailboxes(
  db: Database,
  env: Env,
  userId: string,
) {
  const userMailboxes = await getUserMailboxes(db, userId);
  if (userMailboxes.length === 0) return;

  await Promise.allSettled(
    userMailboxes.map((mb) =>
      catchUpMailboxOnDemand(db, env, mb.id, userId).catch((err) => {
        console.error("catchUpAllMailboxes: mailbox failed", {
          mailboxId: mb.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }),
    ),
  );
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

/** Fetch/refresh specific messages by Gmail ID. Lock-free by design — used
 *  for single-message refresh from UI actions (e.g. after send, archive).
 *  Concurrent writes are safe: inserts use onConflictDoNothing, updates
 *  target specific rows by gmailId. */
export async function syncGmailMessageIds(
  db: Database,
  env: Env,
  mailboxId: number,
  userId: string,
  messageIds: string[],
  refreshExisting = true,
): Promise<GmailSyncResult> {
  const dedupedMessageIds = Array.from(new Set(messageIds.filter(Boolean)));
  if (dedupedMessageIds.length === 0) {
    return { processed: 0, inserted: 0, skipped: 0, historyId: null };
  }

  const accessToken = await getGmailTokenForMailbox(db, mailboxId, {
    GOOGLE_CLIENT_ID: env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: env.GOOGLE_CLIENT_SECRET,
  });
  const { syncCutoffAt } = await getMailboxSyncPreferences(db, mailboxId);

  return processMessageIds({
    db,
    accessToken,
    userId,
    mailboxId,
    messageIds: dedupedMessageIds,
    env,
    refreshExisting,
    minDateMs: syncCutoffAt,
  });
}
