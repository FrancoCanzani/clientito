import type { EmailListItem, EmailListResponse } from "@/features/email/inbox/types";
import { queryClient } from "@/lib/query-client";
import { queryKeys } from "@/lib/query-keys";
import { localDb } from "./client";
import type { emails, emailIntelligence } from "./schema";

const SYNC_PAGE_SIZE = 200;
const INTELLIGENCE_CATCHUP_DELAY_MS = 10_000;
const INTELLIGENCE_CATCHUP_INTERVAL_MS = 20_000;
const INTELLIGENCE_CATCHUP_MAX_ATTEMPTS = 10;
const SYNCED_MAILBOX_KEY_PREFIX = "synced-mailbox";
const SYNCED_ANY_KEY_PREFIX = "synced-any";
const ACTIVE_USER_META_KEY = "active-user-id";

const syncInFlight = new Map<string, Promise<void>>();

function mailboxSyncKey(userId: string, mailboxId: number) {
  return `${SYNCED_MAILBOX_KEY_PREFIX}:${userId}:${mailboxId}`;
}

function userSyncKey(userId: string) {
  return `${SYNCED_ANY_KEY_PREFIX}:${userId}`;
}

function syncTaskKey(userId: string, mailboxId: number) {
  return `${userId}:${mailboxId}`;
}

type SyncEmailListItem = EmailListItem & {
  bodyText?: string | null;
  bodyHtml?: string | null;
};

function emailListItemToRow(item: SyncEmailListItem, userId: string): typeof emails.$inferInsert {
  return {
    id: Number(item.id),
    userId,
    mailboxId: item.mailboxId,
    providerMessageId: item.providerMessageId,
    fromAddr: item.fromAddr,
    fromName: item.fromName,
    toAddr: item.toAddr,
    ccAddr: item.ccAddr,
    subject: item.subject,
    snippet: item.snippet,
    threadId: item.threadId,
    date: item.date,
    direction: item.direction,
    isRead: item.isRead,
    labelIds: item.labelIds,
    unsubscribeUrl: item.unsubscribeUrl,
    unsubscribeEmail: item.unsubscribeEmail,
    snoozedUntil: item.snoozedUntil,
    bodyText: item.bodyText ?? null,
    bodyHtml: item.bodyHtml ?? null,
    createdAt: item.createdAt,
  };
}

function extractIntelligenceRows(items: SyncEmailListItem[], userId: string) {
  const rows: Array<typeof emailIntelligence.$inferInsert> = [];
  const now = Date.now();

  for (const item of items) {
    if (!item.intelligence || item.intelligenceStatus !== "ready") {
      continue;
    }

    rows.push({
      emailId: Number(item.id),
      userId,
      mailboxId: item.mailboxId,
      category: item.intelligence.category,
      suspiciousJson: {
        isSuspicious: item.intelligence.isSuspicious,
      },
      status: "ready",
      schemaVersion: 1,
      attemptCount: 0,
      createdAt: item.createdAt,
      updatedAt: now,
    });
  }

  return rows;
}

async function fetchEmailPage(
  mailboxId: number,
  offset: number,
): Promise<EmailListResponse> {
  const query = new URLSearchParams({
    view: "all",
    mailboxId: String(mailboxId),
    limit: String(SYNC_PAGE_SIZE),
    offset: String(offset),
    includeBody: "true",
    includeAi: "true",
  });

  const response = await fetch(`/api/inbox/emails?${query}`);
  if (!response.ok) {
    throw new Error("Sync fetch failed");
  }
  return response.json();
}

async function pullAll(userId: string, mailboxId: number) {
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const page = await fetchEmailPage(mailboxId, offset);
    const items = page.data as SyncEmailListItem[];
    if (items.length === 0) break;

    const emailRows = items.map((item) => emailListItemToRow(item, userId));
    await localDb.insertEmails(emailRows);

    const intelligenceRows = extractIntelligenceRows(items, userId);
    if (intelligenceRows.length > 0) {
      await localDb.insertEmailIntelligence(intelligenceRows);
    }

    queryClient.invalidateQueries({ queryKey: queryKeys.emails.all() });

    hasMore = page.pagination.hasMore;
    offset += items.length;
  }
}

type IntelligenceUpdate = {
  emailId: number;
  category: "to_respond" | "to_follow_up" | "fyi" | "notification" | "invoice" | "marketing" | null;
  isSuspicious: boolean;
  updatedAt: number;
};

async function fetchIntelligenceUpdates(
  mailboxId: number,
  since: number,
): Promise<IntelligenceUpdate[]> {
  const params = new URLSearchParams({
    mailboxId: String(mailboxId),
    since: String(since),
  });
  const response = await fetch(`/api/inbox/emails/intelligence/updates?${params}`);
  if (!response.ok) return [];
  const result: { data: IntelligenceUpdate[] } = await response.json();
  return result.data;
}

function scheduleIntelligenceCatchUp(userId: string, mailboxId: number) {
  let attempts = 0;
  let since = 0;

  const run = async () => {
    attempts += 1;
    try {
      const missing = await localDb.countEmailsMissingIntelligence(userId, mailboxId);
      if (missing === 0) return;

      const updates = await fetchIntelligenceUpdates(mailboxId, since);

      if (updates.length > 0) {
        const rows: Array<typeof emailIntelligence.$inferInsert> = updates.map((u) => ({
          emailId: u.emailId,
          userId,
          mailboxId,
          category: u.category,
          suspiciousJson: { isSuspicious: u.isSuspicious },
          status: "ready",
          schemaVersion: 1,
          attemptCount: 0,
          createdAt: u.updatedAt,
          updatedAt: u.updatedAt,
        }));

        await localDb.insertEmailIntelligence(rows);
        queryClient.invalidateQueries({ queryKey: queryKeys.emails.all() });
        since = Math.max(...updates.map((u) => u.updatedAt));
      } else if (attempts >= INTELLIGENCE_CATCHUP_MAX_ATTEMPTS) {
        return;
      }
    } catch {
      if (attempts >= INTELLIGENCE_CATCHUP_MAX_ATTEMPTS) return;
    }
    setTimeout(run, INTELLIGENCE_CATCHUP_INTERVAL_MS);
  };

  setTimeout(run, INTELLIGENCE_CATCHUP_DELAY_MS);
}

async function alignActiveUser(userId: string) {
  const activeUser = await localDb.getMeta(ACTIVE_USER_META_KEY);
  if (activeUser && activeUser !== userId) {
    await localDb.clear();
  }
  await localDb.setMeta(ACTIVE_USER_META_KEY, userId);
}

async function runInitialSync(
  userId: string,
  mailboxId: number,
) {
  await localDb.ensureReady();
  await alignActiveUser(userId);

  const mailboxKey = mailboxSyncKey(userId, mailboxId);
  if ((await localDb.getMeta(mailboxKey)) === "true") return;

  await pullAll(userId, mailboxId);

  await localDb.setMeta(mailboxKey, "true");
  await localDb.setMeta(userSyncKey(userId), "true");

  scheduleIntelligenceCatchUp(userId, mailboxId);
}

export async function ensureLocalSync(
  userId: string,
  mailboxId: number,
) {
  const key = syncTaskKey(userId, mailboxId);
  const running = syncInFlight.get(key);
  if (running) {
    await running;
    if (await isSynced(userId, mailboxId)) {
      return;
    }
  }

  const task = runInitialSync(userId, mailboxId).finally(() => {
    syncInFlight.delete(key);
  });

  syncInFlight.set(key, task);
  return task;
}

export async function isSynced(
  userId: string,
  mailboxId?: number,
): Promise<boolean> {
  await localDb.ensureReady();

  if (mailboxId != null) {
    return (await localDb.getMeta(mailboxSyncKey(userId, mailboxId))) === "true";
  }

  return (await localDb.getMeta(userSyncKey(userId))) === "true";
}

export async function clearLocalData() {
  syncInFlight.clear();

  try {
    await localDb.ensureReady();
    await localDb.clear();
  } catch {
    // Ignore worker shutdown/initialization races during logout.
  }
}
