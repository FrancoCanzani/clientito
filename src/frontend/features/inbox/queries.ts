import type { EmailView } from "./utils/inbox-filters";
import type {
  ContactSuggestion,
  EmailThreadItem,
  EmailDetailIntelligence,
  EmailDetailItem,
  EmailListResponse,
  InboxSearchScope,
  InboxSearchSuggestionsResponse,
} from "./types";

type FetchEmailsParams = {
  search?: string;
  isRead?: "true" | "false";
  view?: EmailView;
  limit?: number;
  offset?: number;
  mailboxId?: number;
};

function appendEmailListParams(
  query: URLSearchParams,
  params?: FetchEmailsParams | InboxSearchScope,
) {
  if (!params) return;
  if (params.mailboxId) query.set("mailboxId", String(params.mailboxId));
  if (params.view) query.set("view", params.view);
  if ("includeJunk" in params && params.includeJunk) {
    query.set("includeJunk", "true");
  }
}

function normalizeSearchQuery(query: string) {
  return query.trim().replace(/\s+/g, " ");
}

export async function fetchEmails(
  params?: FetchEmailsParams,
): Promise<EmailListResponse> {
  const query = new URLSearchParams();
  if (params?.search) query.set("search", params.search);
  if (params?.isRead) query.set("isRead", params.isRead);
  if (params?.view) query.set("view", params.view);
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.offset) query.set("offset", String(params.offset));
  if (params?.mailboxId) query.set("mailboxId", String(params.mailboxId));

  const response = await fetch(`/api/inbox/emails?${query}`);
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const message =
      payload && typeof payload.error === "string"
        ? payload.error
        : "Failed to fetch emails";
    throw new Error(message);
  }

  return response.json() as Promise<EmailListResponse>;
}

export async function fetchSearchEmails(
  params: InboxSearchScope & { limit?: number; offset?: number },
): Promise<EmailListResponse> {
  const query = new URLSearchParams();
  const normalizedQuery = normalizeSearchQuery(params.q);
  query.set("q", normalizedQuery);
  if (params.limit) query.set("limit", String(params.limit));
  if (params.offset) query.set("offset", String(params.offset));
  appendEmailListParams(query, params);

  const response = await fetch(`/api/inbox/search/emails?${query}`);
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const message =
      payload && typeof payload.error === "string"
        ? payload.error
        : "Failed to search emails";
    throw new Error(message);
  }

  return response.json() as Promise<EmailListResponse>;
}

export async function fetchEmailDetail(
  emailId: string,
  options?: { refreshLive?: boolean },
): Promise<EmailDetailItem> {
  const params = new URLSearchParams();
  if (options?.refreshLive) {
    params.set("refreshLive", "true");
  }

  const suffix = params.size > 0 ? `?${params.toString()}` : "";
  const response = await fetch(`/api/inbox/emails/${emailId}${suffix}`);
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const message =
      payload && typeof payload.error === "string"
        ? payload.error
        : "Failed to fetch email detail";
    throw new Error(message);
  }

  const json = await response.json();
  return json.data;
}

export async function fetchEmailDetailAI(
  emailId: string,
): Promise<EmailDetailIntelligence> {
  const response = await fetch(`/api/inbox/emails/${emailId}/ai`);
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const message =
      payload && typeof payload.error === "string"
        ? payload.error
        : "Failed to fetch email AI detail";
    throw new Error(message);
  }

  const json = await response.json();
  return json.data;
}

export async function fetchEmailSummary(
  emailId: string,
): Promise<string | null> {
  const response = await fetch(`/api/inbox/emails/${emailId}/ai/summary`);
  if (!response.ok) return null;
  const json = await response.json();
  return json.data?.summary ?? null;
}

export async function fetchEmailThread(
  threadId: string,
): Promise<EmailThreadItem[]> {
  const response = await fetch(`/api/inbox/emails/thread/${threadId}`);
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const message =
      payload && typeof payload.error === "string"
        ? payload.error
        : "Failed to fetch email thread";
    throw new Error(message);
  }

  const json = (await response.json()) as { data: EmailThreadItem[] };
  return json.data;
}

export async function fetchContactSuggestions(
  q: string,
  limit = 8,
): Promise<{ data: ContactSuggestion[] }> {
  const params = new URLSearchParams({ q, limit: String(limit) });
  const response = await fetch(`/api/inbox/search/contacts?${params}`);
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const message =
      payload && typeof payload.error === "string"
        ? payload.error
        : "Failed to fetch contact suggestions";
    throw new Error(message);
  }

  return response.json() as Promise<{ data: ContactSuggestion[] }>;
}

export async function fetchSearchSuggestions(
  params: InboxSearchScope,
): Promise<InboxSearchSuggestionsResponse> {
  const query = new URLSearchParams();
  const normalizedQuery = normalizeSearchQuery(params.q);
  if (normalizedQuery) query.set("q", normalizedQuery);
  appendEmailListParams(query, params);

  const response = await fetch(`/api/inbox/search/suggestions?${query}`);
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const message =
      payload && typeof payload.error === "string"
        ? payload.error
        : "Failed to fetch search suggestions";
    throw new Error(message);
  }

  const json = (await response.json()) as { data: InboxSearchSuggestionsResponse };
  return json.data;
}

export const EMAIL_LIST_PAGE_SIZE = 60;
export const INBOX_SEARCH_PAGE_SIZE = 30;

export function getEmailListQueryKey(
  view: EmailView,
  mailboxId: number,
) {
  return ["emails", view, mailboxId] as const;
}
