import { localDb } from "@/db/client";
import { getCurrentUserId } from "@/db/user";
import { emailQueryKeys } from "@/features/email/mail/shared/query-keys";
import type {
  InboxSearchScope,
  InboxSearchSuggestionsResponse,
} from "@/features/email/mail/shared/types";
import { buildSearchSnippet } from "@/features/email/mail/shared/utils/search-snippet";
import { queryClient } from "@/lib/query-client";
import { alignActiveUser, persistEmails } from "@/features/email/mail/shared/data/local-cache";
import type { PulledEmail, ViewPage } from "@/features/email/mail/shared/data/types";

function searchRefreshKey(params: InboxSearchScope): string {
  return [
    "search-refresh",
    params.mailboxId ?? "none",
    params.view ?? "all",
    params.includeJunk ? "junk" : "nojunk",
    params.q.trim().replace(/\s+/g, " ").toLowerCase(),
  ].join(":");
}

const SEARCH_PAGE_SIZE = 30;
const searchRemoteRefreshed = new Set<string>();

async function refreshRemoteSearch(
  userId: string,
  mailboxId: number,
  query: string,
  includeJunk: boolean,
  refreshKey: string,
  scopeKey: ReturnType<typeof emailQueryKeys.search.results>,
): Promise<void> {
  try {
    const res = await fetch("/api/inbox/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mailboxId, q: query, includeJunk }),
    });
    if (!res.ok) {
      searchRemoteRefreshed.delete(refreshKey);
      return;
    }
    const body = (await res.json()) as { emails: PulledEmail[] };
    if (body.emails?.length) {
      await persistEmails(body.emails, userId, mailboxId);
      void queryClient.invalidateQueries({ queryKey: scopeKey });
    }
  } catch {
    searchRemoteRefreshed.delete(refreshKey);
  }
}

export async function fetchSearchEmails(
  params: InboxSearchScope & { cursor?: string },
): Promise<ViewPage> {
  const userId = await getCurrentUserId();
  if (!userId || !params.mailboxId) return { emails: [], cursor: null };

  await alignActiveUser(userId);

  const normalizedQuery = params.q.trim().replace(/\s+/g, " ");
  if (!normalizedQuery) return { emails: [], cursor: null };

  const offset = params.cursor ? Number(params.cursor) || 0 : 0;
  const refreshKey = searchRefreshKey({ ...params, q: normalizedQuery });

  const local = await localDb.searchEmails({
    userId,
    query: normalizedQuery,
    mailboxId: params.mailboxId,
    view: params.view,
    includeJunk: params.includeJunk ?? false,
    limit: SEARCH_PAGE_SIZE,
    offset,
  });

  const bodyTexts = await localDb.getEmailBodyTextsByIds(
    userId,
    local.data.map((email) => email.id),
  );
  const enhanced = local.data.map((email) => ({
    ...email,
    snippet:
      buildSearchSnippet(bodyTexts.get(email.id), normalizedQuery, email.snippet) ??
      email.snippet,
  }));

  if (offset === 0 && !searchRemoteRefreshed.has(refreshKey)) {
    searchRemoteRefreshed.add(refreshKey);
    const scopeKey = emailQueryKeys.search.results(
      normalizedQuery,
      params.mailboxId,
      params.view ?? "all",
      params.includeJunk ?? false,
    );
    void refreshRemoteSearch(
      userId,
      params.mailboxId,
      normalizedQuery,
      params.includeJunk ?? false,
      refreshKey,
      scopeKey,
    );
  }

  const cursor = local.pagination.hasMore
    ? String(offset + SEARCH_PAGE_SIZE)
    : null;

  return { emails: enhanced, cursor };
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
