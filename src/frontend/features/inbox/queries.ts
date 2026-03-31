import type {
  ContactSuggestion,
  EmailDetailIntelligence,
  EmailDetailItem,
  EmailListItem,
  EmailListResponse,
} from "./types";

type FetchEmailsParams = {
  search?: string;
  isRead?: "true" | "false";
  view?: "inbox" | "sent" | "spam" | "trash" | "snoozed" | "archived" | "starred";
  limit?: number;
  offset?: number;
  mailboxId?: number;
};

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

export async function fetchEmailThread(
  threadId: string,
): Promise<EmailListItem[]> {
  const response = await fetch(`/api/inbox/emails/thread/${threadId}`);
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const message =
      payload && typeof payload.error === "string"
        ? payload.error
        : "Failed to fetch email thread";
    throw new Error(message);
  }

  const json = (await response.json()) as { data: EmailListItem[] };
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
