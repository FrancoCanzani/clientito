import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import type { Context, Hono } from "hono";
import { z } from "zod";
import type { Database } from "../../../db/client";
import { mailboxes } from "../../../db/schema";
import {
  fetchMessage,
  fetchMessagesBatch,
  getCurrentHistoryId,
  getGmailTokenForMailbox,
  listHistoryPage,
  listThreadsPage,
} from "../../../lib/gmail/client";
import { isGmailHistoryExpiredError } from "../../../lib/gmail/errors";
import { resolveMailbox } from "../../../lib/gmail/mailboxes";
import { parseGmailMessage, type ParsedEmail } from "../../../lib/gmail/sync/parse";
import {
  persistMailboxHistoryState,
  resetMailboxSyncState,
} from "../../../lib/gmail/sync/state";
import { fetchThreadsAndParse } from "../../../lib/gmail/sync/threads";
import type { GmailHistoryResponse } from "../../../lib/gmail/types";
import type { AppRouteEnv } from "../../types";

type AppContext = Context<AppRouteEnv>;

const MESSAGE_BATCH_SIZE = 20;
const THREAD_BATCH_SIZE = 10;
const INITIAL_SYNC_MESSAGE_TARGET = 200;

type FullCursor = {
  mode: "full";
  threadIds: string[];
  gmailPageToken: string | null;
  baseHistoryId: string | null;
  messagesPulled: number;
};

type IncrementalCursor = {
  mode: "incremental";
  messageIds: string[];
  historyId: string | null;
};

type PullCursor = FullCursor | IncrementalCursor;

type ViewCursor = {
  query: string | null;
  labelIds: string[];
  beforeMs: number | null;
  threadIds: string[];
  gmailPageToken: string | null;
};

function encodeCursor<T>(cursor: T): string {
  return btoa(JSON.stringify(cursor));
}

function decodeCursor<T>(encoded: string): T {
  return JSON.parse(atob(encoded)) as T;
}

const pullRequestSchema = z.object({
  mailboxId: z.number().int().positive(),
  cursor: z.string().optional(),
});

const pullViewRequestSchema = z.object({
  mailboxId: z.number().int().positive(),
  query: z.string().max(500).optional(),
  labelIds: z.array(z.string().min(1).max(120)).max(10).optional(),
  beforeMs: z.number().int().positive().optional(),
  cursor: z.string().optional(),
});

const resetRequestSchema = z.object({
  mailboxId: z.number().int().positive(),
});

function extractHistoryDelta(history: GmailHistoryResponse["history"]): {
  changedMessageIds: string[];
  deletedMessageIds: string[];
} {
  const changed = new Set<string>();
  const deleted = new Set<string>();

  for (const entry of history ?? []) {
    for (const added of entry.messagesAdded ?? []) {
      if (added.message?.id) changed.add(added.message.id);
    }
    for (const labelsAdded of entry.labelsAdded ?? []) {
      if (labelsAdded.message?.id) changed.add(labelsAdded.message.id);
    }
    for (const labelsRemoved of entry.labelsRemoved ?? []) {
      if (labelsRemoved.message?.id) changed.add(labelsRemoved.message.id);
    }
    for (const deletedEntry of entry.messagesDeleted ?? []) {
      if (deletedEntry.message?.id) deleted.add(deletedEntry.message.id);
    }
  }

  for (const id of deleted) changed.delete(id);

  return {
    changedMessageIds: [...changed],
    deletedMessageIds: [...deleted],
  };
}

async function markMailboxSynced(db: Database, mailboxId: number) {
  await db
    .update(mailboxes)
    .set({ lastSuccessfulSyncAt: Date.now(), updatedAt: Date.now() })
    .where(eq(mailboxes.id, mailboxId));
}

function composeViewQuery(
  baseQuery: string | null,
  beforeMs: number | null,
): string | undefined {
  const parts: string[] = [];
  if (baseQuery) parts.push(baseQuery);
  if (beforeMs != null) {
    const before = new Date(beforeMs);
    const y = before.getUTCFullYear();
    const m = String(before.getUTCMonth() + 1).padStart(2, "0");
    const d = String(before.getUTCDate()).padStart(2, "0");
    parts.push(`before:${y}/${m}/${d}`);
  }
  return parts.length > 0 ? parts.join(" ") : undefined;
}

export function registerPullSync(api: Hono<AppRouteEnv>) {
  api.post(
    "/reset",
    zValidator("json", resetRequestSchema),
    async (c) => {
      const db = c.get("db");
      const user = c.get("user")!;
      const { mailboxId } = c.req.valid("json");

      const mailbox = await resolveMailbox(db, user.id, mailboxId);
      if (!mailbox) return c.json({ error: "No mailbox found" }, 400);

      await resetMailboxSyncState(db, mailbox.id);
      return c.json({ status: "ok" });
    },
  );

  api.post(
    "/pull",
    zValidator("json", pullRequestSchema),
    async (c) => {
      const db = c.get("db");
      const user = c.get("user")!;
      const { mailboxId, cursor: cursorStr } = c.req.valid("json");

      const mailbox = await resolveMailbox(db, user.id, mailboxId);
      if (!mailbox) return c.json({ error: "No mailbox found" }, 400);

      const accessToken = await getGmailTokenForMailbox(db, mailbox.id, {
        GOOGLE_CLIENT_ID: c.env.GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET: c.env.GOOGLE_CLIENT_SECRET,
      });

      if (cursorStr) {
        const cursor = decodeCursor<PullCursor>(cursorStr);
        return cursor.mode === "full"
          ? handleFullSyncPage(c, accessToken, mailbox.id, cursor)
          : handleIncrementalPage(c, accessToken, db, mailbox.id, cursor);
      }

      const mbRow = await db.query.mailboxes.findFirst({
        where: eq(mailboxes.id, mailbox.id),
      });

      if (mbRow?.historyId) {
        return startIncremental(c, accessToken, db, mailbox.id, mbRow.historyId);
      }

      return startFullSync(c, accessToken, db, mailbox.id);
    },
  );

  api.post(
    "/pull-view",
    zValidator("json", pullViewRequestSchema),
    async (c) => {
      const db = c.get("db");
      const user = c.get("user")!;
      const body = c.req.valid("json");

      const mailbox = await resolveMailbox(db, user.id, body.mailboxId);
      if (!mailbox) return c.json({ error: "No mailbox found" }, 400);

      let query: string | null;
      let labelIds: string[];
      let beforeMs: number | null;
      let threadIds: string[];
      let gmailPageToken: string | null;

      if (body.cursor) {
        const cursor = decodeCursor<ViewCursor>(body.cursor);
        query = cursor.query;
        labelIds = cursor.labelIds;
        beforeMs = cursor.beforeMs;
        threadIds = cursor.threadIds;
        gmailPageToken = cursor.gmailPageToken;
      } else {
        query = body.query?.trim() || null;
        labelIds = body.labelIds ?? [];
        beforeMs = body.beforeMs ?? null;
        threadIds = [];
        gmailPageToken = null;
      }

      const accessToken = await getGmailTokenForMailbox(db, mailbox.id, {
        GOOGLE_CLIENT_ID: c.env.GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET: c.env.GOOGLE_CLIENT_SECRET,
      });

      if (threadIds.length === 0 && (!body.cursor || gmailPageToken)) {
        const page = await listThreadsPage(accessToken, {
          pageToken: gmailPageToken ?? undefined,
          query: composeViewQuery(query, beforeMs),
          labelIds: labelIds.length > 0 ? labelIds : undefined,
        });
        threadIds = (page.threads ?? []).map((t) => t.id);
        gmailPageToken = page.nextPageToken ?? null;
      }

      const batch = threadIds.slice(0, THREAD_BATCH_SIZE);
      const remaining = threadIds.slice(THREAD_BATCH_SIZE);
      const emails = await fetchThreadsAndParse(accessToken, batch, null);
      const hasMore = remaining.length > 0 || !!gmailPageToken;

      const nextCursor: ViewCursor | null = hasMore
        ? { query, labelIds, beforeMs, threadIds: remaining, gmailPageToken }
        : null;

      return c.json({
        emails,
        deleted: [] as string[],
        cursor: nextCursor ? encodeCursor(nextCursor) : null,
      });
    },
  );
}

async function startFullSync(
  c: AppContext,
  accessToken: string,
  db: Database,
  mailboxId: number,
) {
  const baseHistoryId = await getCurrentHistoryId(accessToken);

  const page = await listThreadsPage(accessToken, {});
  const allIds = (page.threads ?? []).map((t) => t.id);

  const batch = allIds.slice(0, THREAD_BATCH_SIZE);
  const remaining = allIds.slice(THREAD_BATCH_SIZE);
  const emails = await fetchThreadsAndParse(accessToken, batch, null);

  const messagesPulled = emails.length;
  const reachedTarget = messagesPulled >= INITIAL_SYNC_MESSAGE_TARGET;
  const hasMore =
    !reachedTarget && (remaining.length > 0 || !!page.nextPageToken);

  if (!hasMore && baseHistoryId) {
    await persistMailboxHistoryState(db, mailboxId, baseHistoryId);
    await markMailboxSynced(db, mailboxId);
  }

  const nextCursor: FullCursor | null = hasMore
    ? {
        mode: "full",
        threadIds: remaining,
        gmailPageToken: page.nextPageToken ?? null,
        baseHistoryId,
        messagesPulled,
      }
    : null;

  return c.json({
    emails,
    deleted: [] as string[],
    cursor: nextCursor ? encodeCursor(nextCursor) : null,
  });
}

async function handleFullSyncPage(
  c: AppContext,
  accessToken: string,
  mailboxId: number,
  cursor: FullCursor,
) {
  const db = c.get("db");
  let { threadIds, gmailPageToken } = cursor;
  const { baseHistoryId } = cursor;

  if (threadIds.length === 0 && gmailPageToken) {
    const page = await listThreadsPage(accessToken, {
      pageToken: gmailPageToken,
    });
    threadIds = (page.threads ?? []).map((t) => t.id);
    gmailPageToken = page.nextPageToken ?? null;
  }

  const batch = threadIds.slice(0, THREAD_BATCH_SIZE);
  const remaining = threadIds.slice(THREAD_BATCH_SIZE);
  const emails = await fetchThreadsAndParse(accessToken, batch, null);

  const messagesPulled = cursor.messagesPulled + emails.length;
  const reachedTarget = messagesPulled >= INITIAL_SYNC_MESSAGE_TARGET;
  const hasMore =
    !reachedTarget && (remaining.length > 0 || !!gmailPageToken);

  if (!hasMore && baseHistoryId) {
    await persistMailboxHistoryState(db, mailboxId, baseHistoryId);
    await markMailboxSynced(db, mailboxId);
  }

  const nextCursor: FullCursor | null = hasMore
    ? {
        mode: "full",
        threadIds: remaining,
        gmailPageToken,
        baseHistoryId,
        messagesPulled,
      }
    : null;

  return c.json({
    emails,
    deleted: [] as string[],
    cursor: nextCursor ? encodeCursor(nextCursor) : null,
  });
}

async function startIncremental(
  c: AppContext,
  accessToken: string,
  db: Database,
  mailboxId: number,
  startHistoryId: string,
) {
  try {
    const changedIds: string[] = [];
    const deletedIds: string[] = [];
    let latestHistoryId: string | null = startHistoryId;
    let pageToken: string | undefined;

    do {
      const page = await listHistoryPage(accessToken, startHistoryId, pageToken);
      latestHistoryId = page.historyId ?? latestHistoryId;
      const delta = extractHistoryDelta(page.history);
      changedIds.push(...delta.changedMessageIds);
      deletedIds.push(...delta.deletedMessageIds);
      pageToken = page.nextPageToken;
    } while (pageToken);

    const deletedSet = new Set(deletedIds);
    const uniqueChanged = [...new Set(changedIds)].filter(
      (id) => !deletedSet.has(id),
    );

    const batch = uniqueChanged.slice(0, MESSAGE_BATCH_SIZE);
    const remaining = uniqueChanged.slice(MESSAGE_BATCH_SIZE);

    const emails = await fetchAndParse(accessToken, batch);
    const hasMore = remaining.length > 0;

    if (!hasMore) {
      await persistMailboxHistoryState(db, mailboxId, latestHistoryId);
      await markMailboxSynced(db, mailboxId);
    }

    const nextCursor: IncrementalCursor | null = hasMore
      ? { mode: "incremental", messageIds: remaining, historyId: latestHistoryId }
      : null;

    return c.json({
      emails,
      deleted: [...deletedSet],
      cursor: nextCursor ? encodeCursor(nextCursor) : null,
    });
  } catch (error) {
    if (isGmailHistoryExpiredError(error)) {
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
  c: AppContext,
  accessToken: string,
  db: Database,
  mailboxId: number,
  cursor: IncrementalCursor,
) {
  const { messageIds, historyId } = cursor;

  const batch = messageIds.slice(0, MESSAGE_BATCH_SIZE);
  const remaining = messageIds.slice(MESSAGE_BATCH_SIZE);

  const emails = await fetchAndParse(accessToken, batch);
  const hasMore = remaining.length > 0;

  if (!hasMore && historyId) {
    await persistMailboxHistoryState(db, mailboxId, historyId);
    await markMailboxSynced(db, mailboxId);
  }

  const nextCursor: IncrementalCursor | null = hasMore
    ? { mode: "incremental", messageIds: remaining, historyId }
    : null;

  return c.json({
    emails,
    deleted: [] as string[],
    cursor: nextCursor ? encodeCursor(nextCursor) : null,
  });
}

async function fetchAndParse(
  accessToken: string,
  messageIds: string[],
): Promise<ParsedEmail[]> {
  if (messageIds.length === 0) return [];

  const batchResults = await fetchMessagesBatch(accessToken, messageIds, "full");
  const parsed: ParsedEmail[] = [];

  for (const messageId of messageIds) {
    let message = batchResults.get(messageId) ?? null;
    if (!message) continue;

    if (!message.payload && message.id) {
      try {
        message = await fetchMessage(accessToken, message.id, "full");
      } catch {
        continue;
      }
    }

    const email = parseGmailMessage(message, { minDateMs: null });
    if (email) parsed.push(email);
  }

  return parsed;
}
