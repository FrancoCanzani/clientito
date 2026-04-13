import { localDb } from "@/db/client";
import { ensureLocalSync, isSynced } from "@/db/sync";
import { getCurrentUserId } from "@/db/user";
import type {
  ContactSuggestion,
  DraftItem,
  EmailDetailIntelligence,
  EmailDetailItem,
  EmailListResponse,
  EmailThreadItem,
  InboxSearchScope,
  InboxSearchSuggestionsResponse,
} from "./types";

function normalizeSearchQuery(query: string) {
  return query.trim().replace(/\s+/g, " ");
}

export const EMAIL_LIST_PAGE_SIZE = 100;
export const INBOX_SEARCH_PAGE_SIZE = 30;

function emptyListResponse(
  limit: number,
  offset: number,
  includeSearchMeta = false,
): EmailListResponse {
  return {
    data: [],
    pagination: { limit, offset, hasMore: false },
    ...(includeSearchMeta ? { searchMeta: { hiddenJunkCount: 0 } } : {}),
  };
}

export async function fetchEmails(
  params?: {
    search?: string;
    isRead?: "true" | "false";
    view?: string;
    limit?: number;
    offset?: number;
    mailboxId?: number;
  },
): Promise<EmailListResponse> {
  const userId = await getCurrentUserId();
  const mailboxId = params?.mailboxId;
  if (!userId || mailboxId == null) {
    return emptyListResponse(params?.limit ?? EMAIL_LIST_PAGE_SIZE, params?.offset ?? 0);
  }

  if (!(await isSynced(userId, mailboxId))) {
    ensureLocalSync(userId, mailboxId);
  }

  return localDb.getEmails({
    userId,
    view: params?.view,
    mailboxId,
    limit: params?.limit,
    offset: params?.offset,
    search: params?.search,
    isRead: params?.isRead,
  });
}

export async function fetchSearchEmails(
  params: InboxSearchScope & { limit?: number; offset?: number },
): Promise<EmailListResponse> {
  const normalizedQuery = normalizeSearchQuery(params.q);

  const userId = await getCurrentUserId();
  if (!userId) {
    return emptyListResponse(
      params.limit ?? INBOX_SEARCH_PAGE_SIZE,
      params.offset ?? 0,
      true,
    );
  }

  if (
    params.mailboxId != null &&
    !(await isSynced(userId, params.mailboxId))
  ) {
    ensureLocalSync(userId, params.mailboxId);
  }

  return localDb.searchEmails({
    userId,
    query: normalizedQuery,
    mailboxId: params.mailboxId,
    view: params.view,
    limit: params.limit,
    offset: params.offset,
    includeJunk: params.includeJunk,
  });
}

export async function fetchEmailDetail(
  emailId: string,
  options?: { refreshLive?: boolean; mailboxId?: number; view?: string },
): Promise<EmailDetailItem> {
  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error("Not authenticated");
  }

  if (
    options?.mailboxId != null &&
    !(await isSynced(userId, options.mailboxId))
  ) {
    ensureLocalSync(userId, options.mailboxId);
  }

  let local = await localDb.getEmailDetail(userId, Number(emailId));
  if (local) {
    return local;
  }

  if (options?.mailboxId != null) {
    await ensureLocalSync(userId, options.mailboxId);
    local = await localDb.getEmailDetail(userId, Number(emailId));
    if (local) return local;
  }

  throw new Error("Email not found in local database");
}

export async function fetchEmailDetailAI(
  emailId: string,
): Promise<EmailDetailIntelligence | null> {
  const userId = await getCurrentUserId();
  if (!userId) return null;

  const local = await localDb.getEmailDetailAI(userId, Number(emailId));
  if (local?.summary) return local;

  try {
    const response = await fetch(`/api/inbox/emails/${emailId}/ai`);
    if (!response.ok) return local;
    const result: EmailDetailIntelligence | null = await response.json();
    if (!result) return local;

    await localDb.cacheEmailDetailAI(userId, Number(emailId), result);
    return result;
  } catch {
    return local;
  }
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
  const normalizedQuery = normalizeSearchQuery(params.q);

  const userId = await getCurrentUserId();
  if (!userId) {
    return { filters: [], contacts: [], subjects: [] };
  }

  if (
    params.mailboxId != null &&
    !(await isSynced(userId, params.mailboxId))
  ) {
    ensureLocalSync(userId, params.mailboxId);
  }

  return localDb.getSearchSuggestions({
    userId,
    query: normalizedQuery,
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
