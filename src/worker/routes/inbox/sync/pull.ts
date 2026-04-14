import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import type { Hono } from "hono";
import { mailboxes } from "../../../db/schema";
import {
  fetchMessage,
  fetchMessagesBatch,
  getCurrentHistoryId,
  getGmailTokenForMailbox,
  listHistoryPage,
  listMessagesPage,
} from "../../../lib/gmail/client";
import { resolveMailbox } from "../../../lib/gmail/mailboxes";
import {
  getMailboxSyncPreferences,
  persistMailboxHistoryState,
} from "../../../lib/gmail/sync/state";
import { buildGmailQueryFromCutoff } from "../../../lib/gmail/sync/preferences";
import { parseGmailMessage, type ParsedEmail } from "../../../lib/gmail/sync/parse";
import { extractHistoryDelta } from "../../../lib/gmail/sync/engine";
import { isGmailHistoryExpiredError } from "../../../lib/gmail/errors";
import type { AppRouteEnv } from "../../types";

const PULL_BATCH_SIZE = 20;

const pullRequestSchema = z.object({
  mailboxId: z.number().int().positive(),
  cursor: z.string().optional(),
});

type PullCursor = {
  mode: "full";
  messageIds: string[];
  gmailPageToken: string | null;
  baseHistoryId: string | null;
  cutoffAt: number | null;
} | {
  mode: "incremental";
  messageIds: string[];
  deletedIds: string[];
  historyId: string | null;
};

function encodeCursor(cursor: PullCursor): string {
  return btoa(JSON.stringify(cursor));
}

function decodeCursor(encoded: string): PullCursor {
  return JSON.parse(atob(encoded));
}

export function registerPullSync(api: Hono<AppRouteEnv>) {
  api.post(
    "/pull",
    zValidator("json", pullRequestSchema),
    async (c) => {
      const db = c.get("db");
      const user = c.get("user")!;
      const { mailboxId, cursor: cursorStr } = c.req.valid("json");

      const mailbox = await resolveMailbox(db, user.id, mailboxId);
      if (!mailbox) {
        return c.json({ error: "No mailbox found" }, 400);
      }

      const accessToken = await getGmailTokenForMailbox(db, mailbox.id, {
        GOOGLE_CLIENT_ID: c.env.GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET: c.env.GOOGLE_CLIENT_SECRET,
      });

      // Resume from cursor or start fresh
      if (cursorStr) {
        const cursor = decodeCursor(cursorStr);

        if (cursor.mode === "full") {
          return await handleFullSyncPage(c, accessToken, mailbox.id, cursor);
        }
        return await handleIncrementalPage(c, accessToken, db, mailbox.id, cursor);
      }

      // No cursor — determine mode based on mailbox state
      const mbRow = await db.query.mailboxes.findFirst({
        where: eq(mailboxes.id, mailbox.id),
      });

      if (mbRow?.historyId) {
        // Has history — try incremental
        return await startIncremental(c, accessToken, db, mailbox.id, mbRow.historyId);
      }

      // No history — full sync
      const { syncCutoffAt } = await getMailboxSyncPreferences(db, mailbox.id);
      const gmailQuery = buildGmailQueryFromCutoff(syncCutoffAt);
      const baseHistoryId = await getCurrentHistoryId(accessToken);

      const page = await listMessagesPage(accessToken, undefined, gmailQuery);
      const allIds = (page.messages ?? []).map((m) => m.id);

      // Take first batch, queue the rest
      const batch = allIds.slice(0, PULL_BATCH_SIZE);
      const remaining = allIds.slice(PULL_BATCH_SIZE);

      const emails = await fetchAndParse(accessToken, batch, syncCutoffAt);

      const nextCursor: PullCursor = {
        mode: "full",
        messageIds: remaining,
        gmailPageToken: page.nextPageToken ?? null,
        baseHistoryId,
        cutoffAt: syncCutoffAt,
      };

      const hasMore = remaining.length > 0 || !!page.nextPageToken;

      return c.json({
        emails,
        deleted: [] as string[],
        cursor: hasMore ? encodeCursor(nextCursor) : null,
        total: allIds.length + (page.nextPageToken ? 500 : 0), // estimate
      });
    },
  );
}

async function handleFullSyncPage(
  c: any,
  accessToken: string,
  mailboxId: number,
  cursor: Extract<PullCursor, { mode: "full" }>,
) {
  const db = c.get("db");
  let { messageIds, gmailPageToken, baseHistoryId, cutoffAt } = cursor;

  // If we've exhausted current IDs but have more Gmail pages, fetch next page
  if (messageIds.length === 0 && gmailPageToken) {
    const gmailQuery = buildGmailQueryFromCutoff(cutoffAt);
    const page = await listMessagesPage(accessToken, gmailPageToken, gmailQuery);
    messageIds = (page.messages ?? []).map((m) => m.id);
    gmailPageToken = page.nextPageToken ?? null;
  }

  const batch = messageIds.slice(0, PULL_BATCH_SIZE);
  const remaining = messageIds.slice(PULL_BATCH_SIZE);

  const emails = await fetchAndParse(accessToken, batch, cutoffAt);
  const hasMore = remaining.length > 0 || !!gmailPageToken;

  // When done, persist historyId and run a quick incremental to catch changes during sync
  if (!hasMore && baseHistoryId) {
    await persistMailboxHistoryState(db, mailboxId, baseHistoryId);
    // Mark last successful sync
    await db
      .update(mailboxes)
      .set({ lastSuccessfulSyncAt: Date.now(), updatedAt: Date.now() })
      .where(eq(mailboxes.id, mailboxId));
  }

  const nextCursor: PullCursor | null = hasMore
    ? { mode: "full", messageIds: remaining, gmailPageToken, baseHistoryId, cutoffAt }
    : null;

  return c.json({
    emails,
    deleted: [] as string[],
    cursor: nextCursor ? encodeCursor(nextCursor) : null,
    total: remaining.length + batch.length,
  });
}

async function startIncremental(
  c: any,
  accessToken: string,
  db: any,
  mailboxId: number,
  startHistoryId: string,
) {
  try {
    const changedIds: string[] = [];
    const deletedIds: string[] = [];
    let latestHistoryId: string | null = startHistoryId;
    let pageToken: string | undefined;

    // Collect all history delta (usually small)
    do {
      const page = await listHistoryPage(accessToken, startHistoryId, pageToken);
      latestHistoryId = page.historyId ?? latestHistoryId;
      const delta = extractHistoryDelta(page.history);
      changedIds.push(...delta.changedMessageIds);
      deletedIds.push(...delta.deletedMessageIds);
      pageToken = page.nextPageToken;
    } while (pageToken);

    // Deduplicate
    const deletedSet = new Set(deletedIds);
    const uniqueChanged = [...new Set(changedIds)].filter((id) => !deletedSet.has(id));

    const batch = uniqueChanged.slice(0, PULL_BATCH_SIZE);
    const remaining = uniqueChanged.slice(PULL_BATCH_SIZE);

    const { syncCutoffAt } = await getMailboxSyncPreferences(db, mailboxId);
    const emails = await fetchAndParse(accessToken, batch, syncCutoffAt);

    const hasMore = remaining.length > 0;

    if (!hasMore) {
      await persistMailboxHistoryState(db, mailboxId, latestHistoryId);
      await db
        .update(mailboxes)
        .set({ lastSuccessfulSyncAt: Date.now(), updatedAt: Date.now() })
        .where(eq(mailboxes.id, mailboxId));
    }

    const nextCursor: PullCursor | null = hasMore
      ? { mode: "incremental", messageIds: remaining, deletedIds: [], historyId: latestHistoryId }
      : null;

    return c.json({
      emails,
      deleted: [...deletedSet],
      cursor: nextCursor ? encodeCursor(nextCursor) : null,
      total: uniqueChanged.length,
    });
  } catch (error) {
    if (isGmailHistoryExpiredError(error)) {
      // History expired — need full sync. Clear historyId and let client retry.
      await db
        .update(mailboxes)
        .set({ historyId: null, updatedAt: Date.now() })
        .where(eq(mailboxes.id, mailboxId));
      return c.json({ error: "history_expired", requiresFullSync: true }, 409);
    }
    throw error;
  }
}

async function handleIncrementalPage(
  c: any,
  accessToken: string,
  db: any,
  mailboxId: number,
  cursor: Extract<PullCursor, { mode: "incremental" }>,
) {
  const { messageIds, historyId } = cursor;

  const batch = messageIds.slice(0, PULL_BATCH_SIZE);
  const remaining = messageIds.slice(PULL_BATCH_SIZE);

  const { syncCutoffAt } = await getMailboxSyncPreferences(db, mailboxId);
  const emails = await fetchAndParse(accessToken, batch, syncCutoffAt);

  const hasMore = remaining.length > 0;

  if (!hasMore && historyId) {
    await persistMailboxHistoryState(db, mailboxId, historyId);
    await db
      .update(mailboxes)
      .set({ lastSuccessfulSyncAt: Date.now(), updatedAt: Date.now() })
      .where(eq(mailboxes.id, mailboxId));
  }

  const nextCursor: PullCursor | null = hasMore
    ? { mode: "incremental", messageIds: remaining, deletedIds: [], historyId }
    : null;

  return c.json({
    emails,
    deleted: [] as string[],
    cursor: nextCursor ? encodeCursor(nextCursor) : null,
    total: messageIds.length,
  });
}

async function fetchAndParse(
  accessToken: string,
  messageIds: string[],
  cutoffAt: number | null,
): Promise<ParsedEmail[]> {
  if (messageIds.length === 0) return [];

  const batchResults = await fetchMessagesBatch(accessToken, messageIds, "full");
  const parsed: ParsedEmail[] = [];

  for (const messageId of messageIds) {
    let message = batchResults.get(messageId) ?? null;
    if (!message) continue;

    // If no payload (minimal response), fetch full
    if (!message.payload && message.id) {
      try {
        message = await fetchMessage(accessToken, message.id, "full");
      } catch {
        continue;
      }
    }

    const email = parseGmailMessage(message, { minDateMs: cutoffAt });
    if (email) parsed.push(email);
  }

  return parsed;
}
