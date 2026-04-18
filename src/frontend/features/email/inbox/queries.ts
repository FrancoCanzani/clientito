import { localDb, type EmailInsert } from "@/db/client";
import { getCurrentUserId } from "@/db/user";
import { queryClient } from "@/lib/query-client";
import { queryKeys } from "@/lib/query-keys";
import type {
  ContactSuggestion,
  DraftItem,
  EmailDetailItem,
  EmailListItem,
  EmailListPage,
  EmailThreadItem,
  InboxSearchScope,
  InboxSearchSuggestionsResponse,
} from "./types";

export const VIEW_PAGE_SIZE = 100;

const ACTIVE_USER_KEY = "active-user-id";

type PulledAttachment = {
  attachmentId: string;
  filename: string | null;
  mimeType: string | null;
  size: number | null;
  contentId: string | null;
  isInline: boolean;
  isImage: boolean;
};

type PulledInlineAttachment = {
  contentId: string;
  attachmentId: string;
  mimeType: string | null;
  filename: string | null;
};

type PulledEmail = {
  providerMessageId: string;
  threadId: string | null;
  messageId: string | null;
  fromAddr: string;
  fromName: string | null;
  toAddr: string | null;
  ccAddr: string | null;
  subject: string | null;
  snippet: string | null;
  bodyText: string | null;
  bodyHtml: string | null;
  date: number;
  direction: "sent" | "received";
  isRead: boolean;
  labelIds: string[];
  unsubscribeUrl: string | null;
  unsubscribeEmail: string | null;
  inlineAttachments?: PulledInlineAttachment[];
  attachments?: PulledAttachment[];
};

export type ViewPage = EmailListPage;

function pulledToRow(
  email: PulledEmail,
  userId: string,
  mailboxId: number,
): EmailInsert {
  const labels = new Set(email.labelIds);
  return {
    userId,
    mailboxId,
    providerMessageId: email.providerMessageId,
    fromAddr: email.fromAddr,
    fromName: email.fromName,
    toAddr: email.toAddr,
    ccAddr: email.ccAddr,
    subject: email.subject,
    snippet: email.snippet,
    threadId: email.threadId,
    date: email.date,
    direction: email.direction,
    isRead: email.isRead,
    labelIds: JSON.stringify(email.labelIds),
    hasInbox: labels.has("INBOX"),
    hasSent: labels.has("SENT"),
    hasTrash: labels.has("TRASH"),
    hasSpam: labels.has("SPAM"),
    hasStarred: labels.has("STARRED"),
    unsubscribeUrl: email.unsubscribeUrl,
    unsubscribeEmail: email.unsubscribeEmail,
    snoozedUntil: null,
    bodyText: email.bodyText,
    bodyHtml: email.bodyHtml,
    inlineAttachments:
      email.inlineAttachments && email.inlineAttachments.length > 0
        ? JSON.stringify(email.inlineAttachments)
        : null,
    attachments:
      email.attachments && email.attachments.length > 0
        ? JSON.stringify(email.attachments)
        : null,
    createdAt: email.date,
  };
}

async function alignActiveUser(userId: string): Promise<void> {
  await localDb.ensureReady();
  const active = await localDb.getMeta(ACTIVE_USER_KEY);
  if (active && active !== userId) {
    await localDb.clear();
  }
  if (active !== userId) {
    await localDb.setMeta(ACTIVE_USER_KEY, userId);
  }
}

async function persistEmails(
  pulled: PulledEmail[],
  userId: string,
  mailboxId: number,
): Promise<EmailListItem[]> {
  if (pulled.length === 0) return [];
  const rows = pulled.map((e) => pulledToRow(e, userId, mailboxId));
  await localDb.insertEmails(rows);
  const providerIds = pulled.map((e) => e.providerMessageId);
  const hydrated = await localDb.getEmailsByProviderMessageIds(userId, providerIds);
  const byProviderId = new Map(hydrated.map((r) => [r.providerMessageId, r]));
  return providerIds
    .map((id) => byProviderId.get(id))
    .filter((e): e is EmailListItem => e !== undefined);
}

type LocalCursor = { type: "local"; beforeMs: number };
type RemoteCursor = {
  type: "remote";
  token?: string;
  beforeMs?: number;
};
type DecodedCursor = LocalCursor | RemoteCursor;

function encodeViewCursor(cursor: DecodedCursor): string {
  return btoa(JSON.stringify(cursor));
}

function decodeViewCursor(cursor: string | undefined): DecodedCursor | null {
  if (!cursor) return null;
  try {
    return JSON.parse(atob(cursor)) as DecodedCursor;
  } catch {
    return null;
  }
}

const refreshInFlight = new Map<string, Promise<void>>();

function refreshKey(mailboxId: number, view: string): string {
  return `${mailboxId}:${view}`;
}

async function refreshViewFromServer(
  userId: string,
  mailboxId: number,
  view: string,
): Promise<void> {
  const key = refreshKey(mailboxId, view);
  const existing = refreshInFlight.get(key);
  if (existing) return existing;

  const task = (async () => {
    try {
      const res = await fetch("/api/inbox/view/page", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mailboxId, view, limit: VIEW_PAGE_SIZE }),
      });
      if (!res.ok) return;
      const body = (await res.json()) as {
        emails: PulledEmail[];
        cursor: string | null;
      };
      if (body.emails.length === 0) return;
      const rows = body.emails.map((e) => pulledToRow(e, userId, mailboxId));
      await localDb.insertEmails(rows);
      queryClient.invalidateQueries({
        queryKey: queryKeys.emails.list(view, mailboxId),
      });
    } catch {
      /* background refresh failure is non-fatal */
    }
  })().finally(() => {
    refreshInFlight.delete(key);
  });

  refreshInFlight.set(key, task);
  return task;
}

async function fetchServerPage(
  userId: string,
  mailboxId: number,
  view: string,
  cursor: RemoteCursor,
): Promise<ViewPage> {
  const res = await fetch("/api/inbox/view/page", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mailboxId,
      view,
      cursor: cursor.token || undefined,
      beforeMs: cursor.beforeMs,
      limit: VIEW_PAGE_SIZE,
    }),
  });
  if (!res.ok) throw new Error(`View fetch failed: ${res.status}`);

  const body = (await res.json()) as {
    emails: PulledEmail[];
    cursor: string | null;
  };
  const emails = await persistEmails(body.emails, userId, mailboxId);
  const nextCursor = body.cursor
    ? encodeViewCursor({
        type: "remote",
        token: body.cursor,
        beforeMs: cursor.beforeMs,
      })
    : null;
  return { emails, cursor: nextCursor };
}

export async function fetchViewPage(params: {
  mailboxId: number;
  view: string;
  cursor?: string;
}): Promise<ViewPage> {
  const userId = await getCurrentUserId();
  if (!userId) return { emails: [], cursor: null };

  await alignActiveUser(userId);

  const decoded = decodeViewCursor(params.cursor);

  if (decoded?.type === "remote") {
    return fetchServerPage(userId, params.mailboxId, params.view, decoded);
  }

  const beforeMs = decoded?.type === "local" ? decoded.beforeMs : undefined;
  const local = await localDb.getEmails({
    userId,
    mailboxId: params.mailboxId,
    view: params.view,
    limit: VIEW_PAGE_SIZE,
    cursor: beforeMs,
  });

  // On first page, refresh from server in background to catch new mail.
  if (!decoded) {
    void refreshViewFromServer(userId, params.mailboxId, params.view);
  }

  if (local.data.length === 0) {
    // No local data for this view — fall through to server synchronously.
    return fetchServerPage(userId, params.mailboxId, params.view, {
      type: "remote",
      beforeMs,
    });
  }

  const lastDate = local.data[local.data.length - 1]?.date;

  if (local.pagination.hasMore && lastDate != null) {
    return {
      emails: local.data,
      cursor: encodeViewCursor({ type: "local", beforeMs: lastDate }),
    };
  }

  // Local exhausted — next page switches to server, anchored at oldest local row.
  return {
    emails: local.data,
    cursor: encodeViewCursor({
      type: "remote",
      beforeMs: lastDate ?? undefined,
    }),
  };
}

export async function fetchSearchEmails(
  params: InboxSearchScope & { cursor?: string },
): Promise<ViewPage> {
  const userId = await getCurrentUserId();
  if (!userId || !params.mailboxId) return { emails: [], cursor: null };

  await alignActiveUser(userId);

  const res = await fetch("/api/inbox/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mailboxId: params.mailboxId,
      q: params.q,
      pageToken: params.cursor,
      includeJunk: params.includeJunk ?? false,
    }),
  });
  if (!res.ok) throw new Error(`Search failed: ${res.status}`);

  const body = (await res.json()) as {
    emails: PulledEmail[];
    cursor: string | null;
  };
  const emails = await persistEmails(body.emails, userId, params.mailboxId);
  return { emails, cursor: body.cursor };
}

export async function fetchEmailDetail(
  emailId: string,
  _context?: { mailboxId?: number; view?: string },
): Promise<EmailDetailItem> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error("Not authenticated");

  const numericId = Number(emailId);
  const local = await localDb.getEmailDetail(userId, numericId);
  if (!local) throw new Error("Email not found in local database");
  return local;
}

export async function fetchEmailThread(
  threadId: string,
): Promise<EmailThreadItem[]> {
  const userId = await getCurrentUserId();
  if (!userId) return [];
  return localDb.getEmailThread(userId, threadId);
}

export async function fetchContactSuggestions(
  q: string,
  limit = 8,
): Promise<ContactSuggestion[]> {
  const userId = await getCurrentUserId();
  if (!userId) return [];
  return localDb.getContactSuggestions(userId, q, limit);
}

export async function fetchSearchSuggestions(
  params: InboxSearchScope,
): Promise<InboxSearchSuggestionsResponse> {
  const userId = await getCurrentUserId();
  if (!userId) return { filters: [], contacts: [], subjects: [] };
  return localDb.getSearchSuggestions({
    userId,
    query: params.q.trim().replace(/\s+/g, " "),
    mailboxId: params.mailboxId,
    view: params.view,
  });
}

export function getDraftsQueryKey(
  mailboxId: number | null,
): ["drafts", number | "none"] {
  return ["drafts", mailboxId ?? "none"];
}

export async function fetchDrafts(
  mailboxId: number | null,
): Promise<DraftItem[]> {
  const userId = await getCurrentUserId();
  if (!userId) return [];
  return localDb.getDrafts(userId, mailboxId ?? undefined);
}

export async function deleteDraft(id: number): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error("Not authenticated");
  await localDb.deleteDraft(id, userId);
}

export function invalidateInboxQueries() {
  queryClient.invalidateQueries({ queryKey: queryKeys.emails.all() });
}
