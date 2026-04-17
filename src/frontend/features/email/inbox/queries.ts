import { localDb } from "@/db/client";
import { ensureLocalSync, isSynced, pullNewEmails, remoteSearch } from "@/db/sync";
import { getCurrentUserId } from "@/db/user";
import { queryClient } from "@/lib/query-client";
import { queryKeys } from "@/lib/query-keys";
import type {
  ContactSuggestion,
  DraftItem,
  EmailDetailItem,
  EmailListResponse,
  EmailThreadItem,
  InboxSearchScope,
  InboxSearchSuggestionsResponse,
} from "./types";

function normalizeSearchQuery(query: string) {
  return query.trim().replace(/\s+/g, " ");
}

export const EMAIL_LIST_PAGE_SIZE = 50;
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
    cursor?: number;
    mailboxId?: number;
  },
): Promise<EmailListResponse> {
  const userId = await getCurrentUserId();
  const mailboxId = params?.mailboxId;
  if (!userId || mailboxId == null) {
    return emptyListResponse(params?.limit ?? EMAIL_LIST_PAGE_SIZE, params?.offset ?? 0);
  }

  const offset = params?.offset ?? 0;
  const synced = await isSynced(userId, mailboxId);
  if (offset === 0 && !params?.cursor) {
    if (!synced) {
      // Kick off initial sync in the background — don't block the query.
      // Per-page query invalidations in pullAll() will cause refetches
      // so emails appear progressively as they arrive.
      void ensureLocalSync(userId, mailboxId);
    } else {
      // Already synced — incremental pull from Gmail for new/changed emails
      void pullNewEmails(userId, mailboxId).catch(() => {});
    }
  }

  // Always read from local DB — during initial sync this returns
  // whatever has been inserted so far (progressively filled by pullAll).
  const result = await localDb.getEmails({
    userId,
    view: params?.view,
    mailboxId,
    limit: params?.limit,
    offset: params?.offset,
    cursor: params?.cursor,
    search: params?.search,
    isRead: params?.isRead,
  });
  return result;
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
    await ensureLocalSync(userId, params.mailboxId);
  }

  const offset = params.offset ?? 0;
  if (
    offset === 0 &&
    params.mailboxId != null &&
    normalizedQuery.length >= 2
  ) {
    void remoteSearch(userId, params.mailboxId, normalizedQuery).then(
      (inserted) => {
        if (inserted > 0) {
          queryClient.invalidateQueries({
            queryKey: queryKeys.emails.all(),
          });
        }
      },
    );
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

  const numericId = Number(emailId);
  const existing = await localDb.getEmailDetail(userId, numericId);
  if (existing) return existing;

  if (options?.mailboxId != null) {
    await ensureLocalSync(userId, options.mailboxId);
  }

  const local = await localDb.getEmailDetail(userId, numericId);
  if (!local) {
    throw new Error("Email not found in local database");
  }
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
  const normalizedQuery = normalizeSearchQuery(params.q);

  const userId = await getCurrentUserId();
  if (!userId) {
    return { filters: [], contacts: [], subjects: [] };
  }

  if (
    params.mailboxId != null &&
    !(await isSynced(userId, params.mailboxId))
  ) {
    await ensureLocalSync(userId, params.mailboxId);
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
