import { localDb } from "@/db/client";
import { getCurrentUserId } from "@/db/user";
import type {
  InboxSearchScope,
  InboxSearchSuggestionsResponse,
} from "@/features/email/mail/types";
import { alignActiveUser, persistEmails } from "./local-cache";
import type { PulledEmail, ViewPage } from "./types";

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

  if (offset === 0 && !searchRemoteRefreshed.has(refreshKey)) {
    searchRemoteRefreshed.add(refreshKey);
    try {
      const res = await fetch("/api/inbox/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mailboxId: params.mailboxId,
          q: normalizedQuery,
          includeJunk: params.includeJunk ?? false,
        }),
      });
      if (res.ok) {
        const body = (await res.json()) as { emails: PulledEmail[] };
        await persistEmails(body.emails, userId, params.mailboxId);
      }
    } catch {
      searchRemoteRefreshed.delete(refreshKey);
    }
  }

  const local = await localDb.searchEmails({
    userId,
    query: normalizedQuery,
    mailboxId: params.mailboxId,
    view: params.view,
    includeJunk: params.includeJunk ?? false,
    limit: SEARCH_PAGE_SIZE,
    offset,
  });

  const cursor = local.pagination.hasMore
    ? String(offset + SEARCH_PAGE_SIZE)
    : null;

  return { emails: local.data, cursor };
}

export async function fetchRemoteSearchEmails(
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
