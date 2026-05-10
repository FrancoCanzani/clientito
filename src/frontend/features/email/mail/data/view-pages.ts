import { localDb } from "@/db/client";
import type { SplitRule } from "@/db/schema";
import { getCurrentUserId } from "@/db/user";
import type { EmailListItem } from "@/features/email/mail/types";
import { VIEW_PAGE_SIZE } from "./constants";
import { alignActiveUser } from "./local-cache";
import type { MailListFilters, ViewPage } from "./types";
import { decodeViewCursor, encodeViewCursor } from "./view-cursor";
import { enqueueViewSyncPage, refreshViewFromServer } from "./view-sync";

function toDbCursor(
  decoded: DecodedCursor | null,
): { date: number; id?: number } | undefined {
  if (!decoded || decoded.type !== "local") return undefined;
  return { date: decoded.beforeDate, id: decoded.beforeId };
}

import type { DecodedCursor } from "./types";

export async function fetchViewPage(params: {
  mailboxId: number;
  view: string;
  cursor?: string;
  splitRule?: SplitRule | null;
  filters?: MailListFilters;
}): Promise<ViewPage> {
  const userId = await getCurrentUserId();
  if (!userId) return { emails: [], cursor: null };

  await alignActiveUser(userId);

  const splitRule = params.splitRule ?? null;
  const filters = params.filters;
  const { cursor: decoded, beforeMs } = decodeViewCursor(params.cursor);

  if (decoded?.type === "remote" && splitRule === null) {
    return enqueueViewSyncPage({
      userId,
      mailboxId: params.mailboxId,
      view: params.view,
      remoteCursor: decoded,
      reason: "active-page",
      filters,
      beforeMs,
    });
  }

  const localCursor = toDbCursor(decoded);
  const local = await localDb.getEmails({
    userId,
    mailboxId: params.mailboxId,
    view: params.view,
    limit: VIEW_PAGE_SIZE,
    cursor: localCursor,
    splitRule,
    isRead: filters?.unread ? "false" : undefined,
    starred: filters?.starred,
    hasAttachment: filters?.hasAttachment,
  });

  if (local.data.length === 0) {
    return splitRule !== null
      ? fetchSeededFromServer({
          userId,
          mailboxId: params.mailboxId,
          view: params.view,
          splitRule,
          localCursor,
          beforeMs: localCursor?.date,
          filters,
        })
      : enqueueViewSyncPage({
          userId,
          mailboxId: params.mailboxId,
          view: params.view,
          remoteCursor: { type: "remote" },
          reason: "active-view",
          filters,
          beforeMs: localCursor?.date,
        });
  }

  if (!decoded) {
    void refreshViewFromServer(userId, params.mailboxId, params.view);
  }

  const lastDate =
    local.pagination.cursor?.date ?? local.data[local.data.length - 1]?.date;

  if (local.pagination.hasMore && local.pagination.cursor) {
    return {
      emails: local.data,
      cursor: encodeViewCursor({
        type: "local",
        beforeDate: local.pagination.cursor.date,
        beforeId: local.pagination.cursor.id,
      }),
    };
  }

  if (splitRule !== null) {
    return { emails: local.data, cursor: null };
  }

  return {
    emails: local.data,
    cursor: encodeViewCursor({ type: "remote" }, lastDate ?? undefined),
  };
}

async function fetchSeededFromServer(params: {
  userId: string;
  mailboxId: number;
  view: string;
  splitRule: SplitRule;
  localCursor: { date: number; id?: number } | undefined;
  beforeMs: number | undefined;
  filters?: MailListFilters;
}): Promise<ViewPage> {
  await enqueueViewSyncPage({
    userId: params.userId,
    mailboxId: params.mailboxId,
    view: params.view,
    remoteCursor: { type: "remote" },
    reason: "active-page",
    filters: params.filters,
    beforeMs: params.beforeMs,
  });
  const seeded = await localDb.getEmails({
    userId: params.userId,
    mailboxId: params.mailboxId,
    view: params.view,
    limit: VIEW_PAGE_SIZE,
    cursor: params.localCursor,
    splitRule: params.splitRule,
    isRead: params.filters?.unread ? "false" : undefined,
    starred: params.filters?.starred,
    hasAttachment: params.filters?.hasAttachment,
  });
  if (seeded.pagination.hasMore && seeded.pagination.cursor) {
    return {
      emails: seeded.data,
      cursor: encodeViewCursor({
        type: "local",
        beforeDate: seeded.pagination.cursor.date,
        beforeId: seeded.pagination.cursor.id,
      }),
    };
  }
  return { emails: seeded.data, cursor: null };
}

export async function fetchLocalViewPage(params: {
  mailboxId: number;
  view: string;
  cursor?: string;
  limit?: number;
  splitRule?: SplitRule | null;
}): Promise<ViewPage> {
  const userId = await getCurrentUserId();
  if (!userId) return { emails: [], cursor: null };

  await alignActiveUser(userId);

  const { cursor: decoded } = decodeViewCursor(params.cursor);
  const localCursor = toDbCursor(decoded);

  const local = await localDb.getEmails({
    userId,
    mailboxId: params.mailboxId,
    view: params.view,
    limit: params.limit ?? VIEW_PAGE_SIZE,
    cursor: localCursor,
    splitRule: params.splitRule ?? null,
  });

  if (local.pagination.hasMore && local.pagination.cursor) {
    return {
      emails: local.data,
      cursor: encodeViewCursor({
        type: "local",
        beforeDate: local.pagination.cursor.date,
        beforeId: local.pagination.cursor.id,
      }),
    };
  }

  return { emails: local.data, cursor: null };
}

export async function fetchAllLocalViewEmails(params: {
  mailboxId: number;
  view: string;
  pageSize?: number;
}): Promise<ViewPage> {
  const emails: EmailListItem[] = [];
  let cursor: string | undefined;
  const pageSize = params.pageSize ?? VIEW_PAGE_SIZE;

  do {
    const page = await fetchLocalViewPage({
      mailboxId: params.mailboxId,
      view: params.view,
      cursor,
      limit: pageSize,
    });
    emails.push(...page.emails);
    cursor = page.cursor ?? undefined;
  } while (cursor);

  return { emails, cursor: null };
}