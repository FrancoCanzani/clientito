import { and, eq, inArray } from "drizzle-orm";
import type { Database } from "../../db/client";
import { emails, mailboxes } from "../../db/schema";
import { isAutomatedSender } from "../domains";
import { parseParticipants } from "../participants";
import {
  CHUNK_DELAY_MS,
  MESSAGE_CHUNK_SIZE,
  fetchMessagesBatch,
  getCurrentHistoryId,
  getGmailToken,
  listHistoryPage,
  listMessagesPage,
  sleep,
} from "./client";
import {
  GmailHistoryExpiredError,
  GmailSyncStateError,
  isGmailReconnectRequiredError,
} from "./errors";
import {
  acquireMailboxSyncLock,
  createSyncJob,
  ensureMailbox,
  getMailboxSyncSnapshot,
  markSyncJobFailed,
  markSyncJobSucceeded,
  persistMailboxHistoryState,
  releaseMailboxSyncLock,
  touchMailboxSyncLock,
  type SyncJobErrorClass,
} from "./mailbox-state";
import {
  extractMessageAttachments,
  extractMessageBodyHtml,
  extractMessageBodyText,
  getHeaderValue,
} from "./mailbox";
import { chunkArray } from "../utils";
import type {
  GmailHistoryResponse,
  GmailSyncResult,
  SyncProgressFn,
} from "./types";
import { classifyEmails, type AiLabel } from "../email-classifier";
import {
  applyFilters,
  getUserFilters,
} from "../email-filter-engine";

const HAS_ATTACHMENT_LABEL = "HAS_ATTACHMENT";
const ON_DEMAND_SYNC_MIN_INTERVAL_MS = 60_000;

function maxHistoryId(
  current: string | null,
  candidate?: string | null,
): string | null {
  if (!candidate) {
    return current;
  }
  if (!current) {
    return candidate;
  }

  try {
    return BigInt(candidate) > BigInt(current) ? candidate : current;
  } catch {
    return candidate;
  }
}

function extractAddress(headerValue: string | null): string {
  if (!headerValue) {
    return "";
  }

  const match = headerValue.match(/<([^>]+)>/);
  return (match?.[1] ?? headerValue).trim();
}

type ProcessMessagesInput = {
  db: Database;
  accessToken: string;
  userId: string;
  messageIds: string[];
  env?: Env;
  refreshExisting?: boolean;
  onProgress?: SyncProgressFn;
  onHeartbeat?: () => Promise<void> | Promise<boolean>;
  progressOffset?: number;
  progressTotal?: number;
};

async function processMessageIds({
  db,
  accessToken,
  userId,
  messageIds,
  env,
  refreshExisting = false,
  onProgress,
  onHeartbeat,
  progressOffset = 0,
  progressTotal,
}: ProcessMessagesInput): Promise<GmailSyncResult> {
  const result: GmailSyncResult = {
    processed: 0,
    inserted: 0,
    skipped: 0,
    historyId: null,
  };

  const total = progressTotal ?? messageIds.length;

  for (const chunk of chunkArray(messageIds, MESSAGE_CHUNK_SIZE)) {
    if (chunk.length === 0) {
      continue;
    }

    const existingRows = await db
      .select({ id: emails.id, gmailId: emails.gmailId, labelIds: emails.labelIds })
      .from(emails)
      .where(inArray(emails.gmailId, chunk));

    const existingByGmailId = new Map(
      existingRows.map((row) => [row.gmailId, row]),
    );
    const messageIdsToFetch = refreshExisting
      ? chunk
      : chunk.filter((id) => !existingByGmailId.has(id));

    if (!refreshExisting) {
      result.skipped += chunk.length - messageIdsToFetch.length;
      result.processed += chunk.length - messageIdsToFetch.length;
    }

    // Use Gmail batch API to fetch all messages in a single HTTP call
    const format = refreshExisting ? "minimal" : "full";
    const batchResults = await fetchMessagesBatch(accessToken, messageIdsToFetch, format as "full" | "minimal");

    const pendingInserts: Array<typeof emails.$inferInsert> = [];
    const classificationInputs: Array<{
      gmailId: string;
      from: string;
      subject: string | null;
      snippet: string | null;
    }> = [];

    for (const messageId of messageIdsToFetch) {
      result.processed += 1;
      const message = batchResults.get(messageId) ?? null;
      const existingRow = existingByGmailId.get(messageId);

      if (!message) {
        if (refreshExisting && existingRow) {
          await db
            .delete(emails)
            .where(
              and(
                eq(emails.userId, userId),
                eq(emails.gmailId, messageId),
              ),
            );
        }
        result.skipped += 1;
        continue;
      }

      try {
        const existingEmailId = existingRow?.id ?? null;
        const existingLabelIds = existingRow?.labelIds ?? [];
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
                isRead: !minimalLabelIds.includes("UNREAD"),
                labelIds: minimalLabelIds,
              })
              .where(eq(emails.id, existingEmailId));
            result.historyId = maxHistoryId(result.historyId, message.historyId);
          } else {
            result.skipped += 1;
          }
          continue;
        }

        const rawFrom = getHeaderValue(message.payload?.headers, "From");
        const rawTo = getHeaderValue(message.payload?.headers, "To");
        const rawCc = getHeaderValue(message.payload?.headers, "Cc");
        const rawMessageId = getHeaderValue(
          message.payload?.headers,
          "Message-ID",
        );
        const fromAddr = extractAddress(rawFrom);
        const toAddr = extractAddress(rawTo);
        const subject = getHeaderValue(message.payload?.headers, "Subject");
        const bodyText = extractMessageBodyText(message);
        const bodyHtml = extractMessageBodyHtml(message);
        const labelIds = [...(message.labelIds ?? [])];
        const hasAttachments = extractMessageAttachments(message).length > 0;
        if (hasAttachments && !labelIds.includes(HAS_ATTACHMENT_LABEL)) {
          labelIds.push(HAS_ATTACHMENT_LABEL);
        }
        const isRead = !labelIds.includes("UNREAD");
        const internalDate = Number(message.internalDate ?? "");
        const date =
          Number.isFinite(internalDate) && internalDate > 0
            ? internalDate
            : Date.now();

        const isSent = labelIds.includes("SENT");
        const direction: "sent" | "received" = isSent ? "sent" : "received";

        const fromParticipants = parseParticipants(rawFrom);
        const senderParticipant =
          fromParticipants.find(
            (participant) => participant.email === fromAddr.toLowerCase(),
          ) ??
          fromParticipants[0] ??
          null;
        const fromName = senderParticipant?.name ?? null;
        if (
          direction === "received" &&
          isAutomatedSender(fromAddr, fromName)
        ) {
          result.skipped += 1;
          continue;
        }

        const rawUnsubscribe = getHeaderValue(
          message.payload?.headers,
          "List-Unsubscribe",
        );
        let unsubscribeUrl: string | null = null;
        let unsubscribeEmail: string | null = null;
        if (rawUnsubscribe) {
          const urls =
            rawUnsubscribe.match(/<([^>]+)>/g)?.map((m) => m.slice(1, -1)) ??
            [];
          unsubscribeUrl = urls.find((u) => u.startsWith("http")) ?? null;
          unsubscribeEmail =
            urls
              .find((u) => u.startsWith("mailto:"))
              ?.replace("mailto:", "") ?? null;
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

        if (existingEmailId) {
          await db
            .update(emails)
            .set(emailValues)
            .where(eq(emails.id, existingEmailId));
        } else {
          pendingInserts.push({
            userId,
            gmailId: message.id,
            ...emailValues,
            createdAt: Date.now(),
          });
          if (direction === "received") {
            classificationInputs.push({
              gmailId: message.id!,
              from: fromAddr,
              subject,
              snippet: message.snippet ?? null,
            });
          }
          result.inserted += 1;
        }

        result.historyId = maxHistoryId(result.historyId, message.historyId);
      } catch (error) {
        result.skipped += 1;
        console.error("Failed to store Gmail message", {
          messageId: message.id,
          error,
        });
      }
    }

    // Batch insert new emails to reduce D1 round-trips
    if (pendingInserts.length > 0) {
      const insertChunks = chunkArray(pendingInserts, 5);
      for (const insertChunk of insertChunks) {
        await db.insert(emails).values(insertChunk).onConflictDoNothing({ target: emails.gmailId });
      }
    }

    // Classify newly inserted received emails with Workers AI
    if (env?.AI && classificationInputs.length > 0) {
      try {
        const batch = classificationInputs.map((e, i) => ({
          index: i,
          from: e.from,
          subject: e.subject,
          snippet: e.snippet,
        }));
        const labels = await classifyEmails(env.AI, batch);

        for (const [idx, label] of labels) {
          const gmailId = classificationInputs[idx]?.gmailId;
          if (gmailId) {
            await db
              .update(emails)
              .set({ aiLabel: label })
              .where(
                and(eq(emails.userId, userId), eq(emails.gmailId, gmailId)),
              );
          }
        }
      } catch (error) {
        console.error("AI classification failed, skipping", error);
      }
      classificationInputs.length = 0;
    }

    // Apply user-defined filters to newly inserted emails
    if (pendingInserts.length > 0) {
      try {
        const userFilters = await getUserFilters(db, userId);
        if (userFilters.length > 0) {
          for (const insert of pendingInserts) {
            const emailFields = {
              fromAddr: insert.fromAddr,
              toAddr: insert.toAddr ?? null,
              subject: insert.subject ?? null,
              aiLabel: insert.aiLabel ?? null,
            };
            const actions = applyFilters(emailFields, userFilters);
            if (actions) {
              const updates: Record<string, unknown> = {};
              if (actions.markRead) updates.isRead = true;
              if (actions.applyAiLabel) updates.aiLabel = actions.applyAiLabel;
              if (actions.archive || actions.trash || actions.star) {
                // Modify labelIds in DB (Gmail sync happens separately)
                const currentLabels = (insert.labelIds as string[]) ?? [];
                const newLabels = [...currentLabels];
                if (actions.archive) {
                  const idx = newLabels.indexOf("INBOX");
                  if (idx !== -1) newLabels.splice(idx, 1);
                }
                if (actions.trash && !newLabels.includes("TRASH")) {
                  newLabels.push("TRASH");
                }
                if (actions.star && !newLabels.includes("STARRED")) {
                  newLabels.push("STARRED");
                }
                updates.labelIds = newLabels;
              }
              if (Object.keys(updates).length > 0) {
                await db
                  .update(emails)
                  .set(updates)
                  .where(
                    and(
                      eq(emails.userId, userId),
                      eq(emails.gmailId, insert.gmailId!),
                    ),
                  );
              }
            }
          }
        }
      } catch (error) {
        console.error("Filter application failed, skipping", error);
      }
    }

    if (onProgress) {
      await onProgress("fetching", progressOffset + result.processed, total);
    }

    await onHeartbeat?.();

    if (result.processed < total) {
      await sleep(CHUNK_DELAY_MS);
    }
  }

  return result;
}

type HistoryDelta = {
  changedMessageIds: string[];
  deletedMessageIds: string[];
};

type SyncExecutionOptions = {
  skipLock?: boolean;
};

export async function startFullGmailSync(
  db: Database,
  env: Env,
  userId: string,
  onProgress?: SyncProgressFn,
  gmailQuery?: string,
  options?: SyncExecutionOptions,
): Promise<GmailSyncResult> {
  const hasLock =
    options?.skipLock === true ? true : await acquireMailboxSyncLock(db, userId);
  if (!hasLock) {
    throw new GmailSyncStateError("Sync already in progress.");
  }

  try {
    const accessToken = await getGmailToken(db, userId, {
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

    await onProgress?.("fetching", 0, allMessageIds.length);
    const result = await processMessageIds({
      db,
      accessToken,
      userId,
      messageIds: allMessageIds,
      env,
      onProgress,
      onHeartbeat: () => touchMailboxSyncLock(db, userId),
      progressOffset: 0,
      progressTotal: allMessageIds.length,
    });

    if (historyIdBeforeFullSync) {
      const deltaResult = await runIncrementalGmailSyncWithAccessToken({
        db,
        accessToken,
        userId,
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

    await persistMailboxHistoryState(db, userId, latestHistoryId);
    return result;
  } finally {
    if (options?.skipLock !== true) {
      await releaseMailboxSyncLock(db, userId);
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
      if (messageId) {
        changedMessageIds.add(messageId);
      }
    }

    for (const labelsAdded of entry.labelsAdded ?? []) {
      const messageId = labelsAdded.message?.id;
      if (messageId) {
        changedMessageIds.add(messageId);
      }
    }

    for (const labelsRemoved of entry.labelsRemoved ?? []) {
      const messageId = labelsRemoved.message?.id;
      if (messageId) {
        changedMessageIds.add(messageId);
      }
    }

    for (const deleted of entry.messagesDeleted ?? []) {
      const messageId = deleted.message?.id;
      if (messageId) {
        deletedMessageIds.add(messageId);
      }
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

async function deleteMessagesByGmailIds(
  db: Database,
  userId: string,
  gmailIds: string[],
): Promise<void> {
  if (gmailIds.length === 0) {
    return;
  }

  await db
    .delete(emails)
    .where(and(eq(emails.userId, userId), inArray(emails.gmailId, gmailIds)));
}

type IncrementalSyncCoreInput = {
  db: Database;
  accessToken: string;
  userId: string;
  startHistoryId: string;
  env?: Env;
};

async function runIncrementalGmailSyncWithAccessToken({
  db,
  accessToken,
  userId,
  startHistoryId,
  env,
}: IncrementalSyncCoreInput): Promise<GmailSyncResult> {
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
  const heartbeat = () => touchMailboxSyncLock(db, userId);

  do {
    await heartbeat();
    const page = await listHistoryPage(accessToken, startHistoryId, pageToken);
    latestHistoryId = maxHistoryId(latestHistoryId, page.historyId);

    for (const entry of page.history ?? []) {
      latestHistoryId = maxHistoryId(latestHistoryId, entry.id);
    }

    const historyDelta = extractHistoryDelta(page.history);
    const pageDeletedMessageIds = historyDelta.deletedMessageIds.filter((id) => {
      if (seenDeletedMessageIds.has(id)) {
        return false;
      }
      seenDeletedMessageIds.add(id);
      return true;
    });
    const pageChangedMessageIds = historyDelta.changedMessageIds.filter((id) => {
      if (seenChangedMessageIds.has(id) || seenDeletedMessageIds.has(id)) {
        return false;
      }
      seenChangedMessageIds.add(id);
      return true;
    });

    await deleteMessagesByGmailIds(db, userId, pageDeletedMessageIds);
    aggregate.processed += pageDeletedMessageIds.length;

    const pageResult = await processMessageIds({
      db,
      accessToken,
      userId,
      messageIds: pageChangedMessageIds,
      env,
      refreshExisting: true,
      onHeartbeat: heartbeat,
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
  await persistMailboxHistoryState(db, userId, latestHistoryId);

  return aggregate;
}

function classifySyncError(error: unknown): SyncJobErrorClass {
  if (isGmailReconnectRequiredError(error)) {
    return "reconnect_required";
  }

  if (
    error instanceof Error &&
    error.message.toLowerCase().includes("full sync again")
  ) {
    return "history_expired";
  }

  if (error instanceof GmailSyncStateError) {
    return "state_error";
  }

  return "sync_failed";
}

export async function runIncrementalGmailSync(
  db: Database,
  env: Env,
  userId: string,
  startHistoryIdInput?: string | null,
  options?: SyncExecutionOptions,
): Promise<GmailSyncResult> {
  const hasLock =
    options?.skipLock === true ? true : await acquireMailboxSyncLock(db, userId);
  if (!hasLock) {
    throw new GmailSyncStateError("Sync already in progress.");
  }

  try {
    const mailbox = await db.query.mailboxes.findFirst({
      where: eq(mailboxes.userId, userId),
    });
    const startHistoryId = startHistoryIdInput ?? mailbox?.historyId ?? null;
    if (!startHistoryId) {
      throw new GmailSyncStateError(
        "No sync state found. Run full sync first.",
      );
    }

    const accessToken = await getGmailToken(db, userId, {
      GOOGLE_CLIENT_ID: env.GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET: env.GOOGLE_CLIENT_SECRET,
    });

    const result = await runIncrementalGmailSyncWithAccessToken({
      db,
      accessToken,
      userId,
      startHistoryId,
      env,
    });
    return result;
  } finally {
    if (options?.skipLock !== true) {
      await releaseMailboxSyncLock(db, userId);
    }
  }
}

export async function catchUpMailboxOnDemand(
  db: Database,
  env: Env,
  userId: string,
  userEmail: string,
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
  // One-time: clean up broken rows inserted without headers, reset historyId to re-sync
  const brokenRows = await db
    .select({ id: emails.id })
    .from(emails)
    .where(and(eq(emails.userId, userId), eq(emails.fromAddr, "")))
    .limit(1);
  if (brokenRows.length > 0) {
    await db
      .delete(emails)
      .where(and(eq(emails.userId, userId), eq(emails.fromAddr, "")));
    await db
      .update(mailboxes)
      .set({ historyId: null })
      .where(eq(mailboxes.userId, userId));
  }

  const snapshot = await getMailboxSyncSnapshot(db, userId);
  const mailbox = snapshot.mailbox ?? (await ensureMailbox(db, userId, userEmail));

  if (!mailbox?.historyId) {
    return { status: "skipped", reason: "needs_full_sync" };
  }

  if (mailbox.authState === "reconnect_required") {
    return { status: "skipped", reason: "reconnect_required" };
  }

  if (snapshot.hasLiveLock) {
    return { status: "skipped", reason: "sync_in_progress" };
  }

  const minIntervalMs =
    options?.minIntervalMs ?? ON_DEMAND_SYNC_MIN_INTERVAL_MS;
  if (
    options?.force !== true &&
    mailbox.lastSuccessfulSyncAt !== null &&
    mailbox.lastSuccessfulSyncAt + minIntervalMs > Date.now()
  ) {
    return { status: "skipped", reason: "recently_synced" };
  }

  const hasLock = await acquireMailboxSyncLock(db, userId, userEmail);
  if (!hasLock) {
    return { status: "skipped", reason: "sync_in_progress" };
  }

  const job = await createSyncJob(db, mailbox.id, "incremental", "system");

  try {
    let result: GmailSyncResult;
    try {
      result = await runIncrementalGmailSync(
        db,
        env,
        userId,
        mailbox.historyId,
        { skipLock: true },
      );
    } catch (error) {
      if (error instanceof GmailHistoryExpiredError) {
        console.warn("On-demand sync: history expired, falling back to full sync", { userId });
        result = await startFullGmailSync(db, env, userId, undefined, undefined, { skipLock: true });
      } else {
        throw error;
      }
    }

    await markSyncJobSucceeded(db, mailbox.id, job.id);
    return { status: "completed", result };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sync failed";

    if (isGmailReconnectRequiredError(error)) {
      console.warn("On-demand Gmail sync requires Google reconnect", {
        userId,
      });
    } else {
      console.error("On-demand Gmail sync failed", { userId, error });
    }

    await markSyncJobFailed(
      db,
      mailbox.id,
      job.id,
      message,
      classifySyncError(error),
    ).catch(() => {});

    return { status: "failed", error: message };
  } finally {
    await releaseMailboxSyncLock(db, userId).catch(() => {});
  }
}

export async function syncGmailMessageIds(
  db: Database,
  env: Env,
  userId: string,
  messageIds: string[],
  refreshExisting = true,
): Promise<GmailSyncResult> {
  const dedupedMessageIds = Array.from(new Set(messageIds.filter(Boolean)));
  if (dedupedMessageIds.length === 0) {
    return {
      processed: 0,
      inserted: 0,
      skipped: 0,
      historyId: null,
    };
  }

  const accessToken = await getGmailToken(db, userId, {
    GOOGLE_CLIENT_ID: env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: env.GOOGLE_CLIENT_SECRET,
  });

  return processMessageIds({
    db,
    accessToken,
    userId,
    messageIds: dedupedMessageIds,
    env,
    refreshExisting,
  });
}
