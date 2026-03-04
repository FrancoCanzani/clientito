import { and, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { account, user } from "../../db/auth-schema";
import type { Database } from "../../db/client";
import { companies, emails, people, syncState } from "../../db/schema";
import { isAutomatedSender, isPublicDomain } from "../domains";
import {
  extractDomain,
  getPrimaryPerson,
  parseParticipants,
} from "../participants";
import {
  GOOGLE_RECONNECT_REQUIRED_MESSAGE,
  GmailSyncStateError,
  isGmailReconnectRequiredError,
} from "./errors";
import {
  fetchMessageBatch,
  getCurrentHistoryId,
  listHistoryPage,
  listMessagesPage,
  sleep,
  CHUNK_DELAY_MS,
  FETCH_CONCURRENCY,
  MESSAGE_CHUNK_SIZE,
} from "./api";
import { getGmailToken, syncGoogleUserProfile } from "./token";
import { extractMessageAttachments } from "./message";
import { extractMessageBodyHtml, extractMessageBodyText } from "./message";
import type { GmailSyncResult, GmailHistoryResponse, SyncProgressFn } from "./types";

const HAS_ATTACHMENT_LABEL = "HAS_ATTACHMENT";
const SYNC_LOCK_TTL_MS = 4 * 60_000;

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

function chunkArray<T>(list: T[], size: number): T[][] {
  const chunks: T[][] = [];

  for (let index = 0; index < list.length; index += size) {
    chunks.push(list.slice(index, index + size));
  }

  return chunks;
}

async function runConcurrent<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const i = index++;
      results[i] = await fn(items[i]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  );
  return results;
}

function extractAddress(headerValue: string | null): string {
  if (!headerValue) {
    return "";
  }

  const match = headerValue.match(/<([^>]+)>/);
  return (match?.[1] ?? headerValue).trim();
}

function getHeaderValue(
  headers: Array<{ name?: string; value?: string }> | undefined,
  headerName: string,
): string | null {
  if (!headers || headers.length === 0) {
    return null;
  }

  const header = headers.find(
    (entry) => entry.name?.toLowerCase() === headerName.toLowerCase(),
  );

  return header?.value?.trim() ?? null;
}

async function getUserEmail(db: Database, userId: string): Promise<string> {
  const u = await db.query.user.findFirst({
    where: eq(user.id, userId),
    columns: { email: true },
  });
  return u?.email ?? "";
}

async function upsertPersonAndCompany(
  db: Database,
  userId: string,
  participant: { email: string; name: string | null },
  contactDate: number,
): Promise<number | null> {
  if (isAutomatedSender(participant.email)) {
    return null;
  }

  const domain = extractDomain(participant.email);
  let companyId: number | null = null;

  if (domain && !isPublicDomain(domain)) {
    const displayNameBase = domain.split(".")[0] ?? "";
    const displayName = displayNameBase
      ? `${displayNameBase.charAt(0).toUpperCase()}${displayNameBase.slice(1)}`
      : null;

    const inserted = await db
      .insert(companies)
      .values({
        userId,
        domain,
        name: displayName,
        createdAt: Date.now(),
      })
      .onConflictDoNothing({ target: [companies.userId, companies.domain] })
      .returning({ id: companies.id });

    if (inserted.length > 0) {
      companyId = inserted[0].id;
    } else {
      const existing = await db.query.companies.findFirst({
        where: and(eq(companies.userId, userId), eq(companies.domain, domain)),
        columns: { id: true, name: true },
      });
      companyId = existing?.id ?? null;

      if (displayName && existing?.id && !existing.name) {
        await db
          .update(companies)
          .set({ name: sql<string>`coalesce(${companies.name}, ${displayName})` })
          .where(and(eq(companies.id, existing.id), eq(companies.userId, userId)));
      }
    }
  }

  const now = Date.now();
  const inserted = await db
    .insert(people)
    .values({
      userId,
      email: participant.email,
      name: participant.name,
      companyId,
      lastContactedAt: contactDate,
      createdAt: now,
    })
    .onConflictDoUpdate({
      target: [people.userId, people.email],
      set: {
        name: participant.name
          ? participant.name
          : undefined,
        companyId: companyId ?? undefined,
        lastContactedAt: contactDate,
      },
    })
    .returning({ id: people.id });

  return inserted[0]?.id ?? null;
}

type ProcessMessagesInput = {
  db: Database;
  accessToken: string;
  userId: string;
  userEmail: string;
  messageIds: string[];
  onProgress?: SyncProgressFn;
  progressOffset?: number;
  progressTotal?: number;
};

async function processMessageIds({
  db,
  accessToken,
  userId,
  userEmail,
  messageIds,
  onProgress,
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
      .select({ gmailId: emails.gmailId })
      .from(emails)
      .where(inArray(emails.gmailId, chunk));

    const existingIds = new Set(existingRows.map((row) => row.gmailId));
    const newIds = chunk.filter((id) => !existingIds.has(id));
    result.skipped += chunk.length - newIds.length;
    result.processed += chunk.length - newIds.length;

    const messages = await runConcurrent(
      newIds,
      FETCH_CONCURRENCY,
      async (messageId) => {
        try {
          return await fetchMessageBatch(accessToken, messageId);
        } catch (error) {
          console.error("Failed to fetch Gmail message", { messageId, error });
          return null;
        }
      },
    );

    for (const message of messages) {
      result.processed += 1;

      if (!message) {
        result.skipped += 1;
        continue;
      }

      try {
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
        const toParticipants = parseParticipants(rawTo);
        const ccParticipants = parseParticipants(rawCc);
        const senderParticipant =
          fromParticipants.find(
            (participant) => participant.email === fromAddr.toLowerCase(),
          ) ??
          fromParticipants[0] ??
          null;
        const fromName = senderParticipant?.name ?? null;
        const primary = getPrimaryPerson(
          fromParticipants,
          toParticipants,
          ccParticipants,
          userEmail,
          direction,
        );

        let personId: number | null = null;
        if (primary) {
          personId = await upsertPersonAndCompany(
            db,
            userId,
            primary,
            date,
          );
        }

        const inserted = await db
          .insert(emails)
          .values({
            userId,
            gmailId: message.id,
            threadId: message.threadId ?? null,
            messageId: rawMessageId ?? null,
            personId,
            fromAddr,
            fromName,
            toAddr: toAddr || null,
            subject,
            snippet: message.snippet ?? null,
            bodyText: bodyText || null,
            bodyHtml: bodyHtml || null,
            date,
            direction,
            isRead,
            labelIds,
            createdAt: Date.now(),
          })
          .onConflictDoNothing({ target: emails.gmailId })
          .returning({ id: emails.id });

        if (inserted.length > 0) {
          result.inserted += 1;
        } else {
          result.skipped += 1;
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

    if (onProgress) {
      await onProgress("fetching", progressOffset + result.processed, total);
    }

    if (result.processed < total) {
      await sleep(CHUNK_DELAY_MS);
    }
  }

  return result;
}

type PersistSyncStateInput = {
  db: Database;
  userId: string;
  historyId: string | null;
};

async function persistSyncState({
  db,
  userId,
  historyId,
}: PersistSyncStateInput) {
  const now = Date.now();
  const existing = await db.query.syncState.findFirst({
    where: eq(syncState.userId, userId),
  });

  if (existing) {
    await db
      .update(syncState)
      .set({
        historyId,
        lastSync: now,
      })
      .where(eq(syncState.userId, userId));
    return;
  }

  await db.insert(syncState).values({
    userId,
    historyId,
    lastSync: now,
  });
}

async function acquireSyncLock(
  db: Database,
  userId: string,
): Promise<boolean> {
  const now = Date.now();
  const lockUntil = now + SYNC_LOCK_TTL_MS;

  await db
    .insert(syncState)
    .values({
      userId,
      historyId: null,
      lastSync: null,
      lockUntil: null,
    })
    .onConflictDoNothing({ target: syncState.userId });

  const locked = await db
    .update(syncState)
    .set({
      lockUntil,
    })
    .where(
      and(
        eq(syncState.userId, userId),
        or(isNull(syncState.lockUntil), lt(syncState.lockUntil, now)),
      ),
    )
    .returning({ id: syncState.id });

  return locked.length > 0;
}

async function releaseSyncLock(db: Database, userId: string): Promise<void> {
  await db
    .update(syncState)
    .set({
      lockUntil: null,
    })
    .where(eq(syncState.userId, userId));
}

export async function startFullGmailSync(
  db: Database,
  env: Env,
  userId: string,
  onProgress?: SyncProgressFn,
  gmailQuery?: string,
): Promise<GmailSyncResult> {
  const hasLock = await acquireSyncLock(db, userId);
  if (!hasLock) {
    throw new GmailSyncStateError(
      "Sync already in progress.",
    );
  }

  try {
    const accessToken = await getGmailToken(db, userId, {
      GOOGLE_CLIENT_ID: env.GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET: env.GOOGLE_CLIENT_SECRET,
    });
    await syncGoogleUserProfile(db, userId, accessToken).catch(() => {});

    const userEmail = await getUserEmail(db, userId);

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
      userEmail,
      messageIds: allMessageIds,
      onProgress,
      progressOffset: 0,
      progressTotal: allMessageIds.length,
    });

    const latestHistoryId = maxHistoryId(
      result.historyId,
      await getCurrentHistoryId(accessToken),
    );
    result.historyId = latestHistoryId;

    await persistSyncState({ db, userId, historyId: latestHistoryId });
    return result;
  } finally {
    await releaseSyncLock(db, userId);
  }
}

function extractMessageIdsFromHistory(
  history: GmailHistoryResponse["history"],
): string[] {
  const ids: string[] = [];

  for (const entry of history ?? []) {
    for (const added of entry.messagesAdded ?? []) {
      const messageId = added.message?.id;
      if (messageId) {
        ids.push(messageId);
      }
    }
  }

  return ids;
}

export async function runIncrementalGmailSync(
  db: Database,
  env: Env,
  userId: string,
  startHistoryIdInput?: string | null,
): Promise<GmailSyncResult> {
  const hasLock = await acquireSyncLock(db, userId);
  if (!hasLock) {
    throw new GmailSyncStateError(
      "Sync already in progress.",
    );
  }

  try {
    const state = await db.query.syncState.findFirst({
      where: eq(syncState.userId, userId),
    });
    const startHistoryId = startHistoryIdInput ?? state?.historyId ?? null;
    if (!startHistoryId) {
      throw new GmailSyncStateError(
        "No sync state found. Run full sync first.",
      );
    }

    const accessToken = await getGmailToken(db, userId, {
      GOOGLE_CLIENT_ID: env.GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET: env.GOOGLE_CLIENT_SECRET,
    });
    await syncGoogleUserProfile(db, userId, accessToken).catch(() => {});

    const userEmail = await getUserEmail(db, userId);

    let pageToken: string | undefined;
    let latestHistoryId: string | null = startHistoryId;
    const seenMessageIds = new Set<string>();
    const aggregate: GmailSyncResult = {
      processed: 0,
      inserted: 0,
      skipped: 0,
      historyId: null,
    };

    do {
      const page = await listHistoryPage(
        accessToken,
        startHistoryId,
        pageToken,
      );
      latestHistoryId = maxHistoryId(latestHistoryId, page.historyId);

      for (const entry of page.history ?? []) {
        latestHistoryId = maxHistoryId(latestHistoryId, entry.id);
      }

      const pageMessageIds = extractMessageIdsFromHistory(page.history).filter(
        (id) => {
          if (seenMessageIds.has(id)) {
            return false;
          }
          seenMessageIds.add(id);
          return true;
        },
      );

      const pageResult = await processMessageIds({
        db,
        accessToken,
        userId,
        userEmail,
        messageIds: pageMessageIds,
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
    await persistSyncState({
      db,
      userId,
      historyId: latestHistoryId,
    });

    return aggregate;
  } finally {
    await releaseSyncLock(db, userId);
  }
}

export async function runScheduledIncrementalSync(
  db: Database,
  env: Env,
): Promise<void> {
  const states = await db
    .select({
      userId: syncState.userId,
      historyId: syncState.historyId,
      error: syncState.error,
      refreshToken: account.refreshToken,
    })
    .from(syncState)
    .leftJoin(
      account,
      and(
        eq(account.userId, syncState.userId),
        eq(account.providerId, "google"),
      ),
    );

  for (const state of states) {
    if (!state.historyId) {
      continue;
    }

    if (!state.refreshToken) {
      if (state.error !== GOOGLE_RECONNECT_REQUIRED_MESSAGE) {
        console.warn("Scheduled Gmail sync requires Google reconnect", {
          userId: state.userId,
        });
      }
      await db
        .update(syncState)
        .set({
          phase: "error",
          progressCurrent: null,
          progressTotal: null,
          error: GOOGLE_RECONNECT_REQUIRED_MESSAGE,
        })
        .where(eq(syncState.userId, state.userId));
      continue;
    }

    try {
      await runIncrementalGmailSync(
        db,
        env,
        state.userId,
        state.historyId,
      );
      if (state.error) {
        await db
          .update(syncState)
          .set({
            phase: null,
            progressCurrent: null,
            progressTotal: null,
            error: null,
          })
          .where(eq(syncState.userId, state.userId));
      }
    } catch (error) {
      if (error instanceof GmailSyncStateError) {
        continue;
      }

      if (isGmailReconnectRequiredError(error)) {
        if (state.error !== GOOGLE_RECONNECT_REQUIRED_MESSAGE) {
          console.warn("Scheduled Gmail sync requires Google reconnect", {
            userId: state.userId,
          });
        }
        await db
          .update(syncState)
          .set({
            phase: "error",
            progressCurrent: null,
            progressTotal: null,
            error: GOOGLE_RECONNECT_REQUIRED_MESSAGE,
          })
          .where(eq(syncState.userId, state.userId));
      } else {
        console.error("Scheduled Gmail incremental sync failed", {
          userId: state.userId,
          error,
        });
        await db
          .update(syncState)
          .set({
            phase: "error",
            progressCurrent: null,
            progressTotal: null,
            error: error instanceof Error ? error.message : "Sync failed",
          })
          .where(eq(syncState.userId, state.userId));
      }
    }
  }
}
