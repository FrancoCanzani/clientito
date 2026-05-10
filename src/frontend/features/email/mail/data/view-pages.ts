import { localDb } from "@/db/client";
import type { SplitRule } from "@/db/schema";
import { getCurrentUserId } from "@/db/user";
import type { EmailListItem } from "@/features/email/mail/types";
import { VIEW_PAGE_SIZE } from "./constants";
import { alignActiveUser } from "./local-cache";
import type { MailListFilters, ViewPage } from "./types";
import { decodeViewCursor, encodeViewCursor } from "./view-cursor";
import { enqueueViewSyncPage } from "./view-sync";

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
  const splitScoped = splitRule !== null;
  const filters = params.filters;
  const decoded = decodeViewCursor(params.cursor);

  if (decoded?.type === "remote" && !splitScoped) {
    return enqueueViewSyncPage({
      userId,
      mailboxId: params.mailboxId,
      view: params.view,
      cursor: decoded,
      reason: "active-page",
      filters,
    });
  }

  const localCursor =
    decoded?.type === "local"
      ? "beforeDate" in decoded
        ? {
            date: decoded.beforeDate,
            id: decoded.beforeId,
          }
        : typeof decoded.beforeMs === "number"
          ? { date: decoded.beforeMs }
          : undefined
      : undefined;
  const beforeMs = localCursor?.date;
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
    if (splitScoped) {
      await enqueueViewSyncPage({
        userId,
        mailboxId: params.mailboxId,
        view: params.view,
        cursor: { type: "remote", beforeMs },
        reason: "active-page",
        filters,
      });
      const seeded = await localDb.getEmails({
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
    return enqueueViewSyncPage({
      userId,
      mailboxId: params.mailboxId,
      view: params.view,
      cursor: { type: "remote", beforeMs },
      reason: "active-view",
      filters,
    });
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

  if (splitScoped) {
    return { emails: local.data, cursor: null };
  }

  return {
    emails: local.data,
    cursor: encodeViewCursor({
      type: "remote",
      beforeMs: lastDate ?? undefined,
    }),
  };
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

  const decoded = decodeViewCursor(params.cursor);
  const localCursor =
    decoded?.type === "local"
      ? "beforeDate" in decoded
        ? {
            date: decoded.beforeDate,
            id: decoded.beforeId,
          }
        : typeof decoded.beforeMs === "number"
          ? { date: decoded.beforeMs }
          : undefined
      : undefined;

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
