import { apiFetch } from "@/lib/api";

export type EmailSearchResult = {
  id: string;
  gmailId: string;
  fromAddr: string;
  fromName: string | null;
  toAddr: string | null;
  subject: string | null;
  snippet: string | null;
  date: number;
  isRead: boolean;
  labelIds: string[];
  isCustomer: boolean;
  customerId: string | null;
  customerName: string | null;
};

export type EmailListItem = {
  id: string;
  gmailId: string;
  fromAddr: string;
  fromName: string | null;
  toAddr: string | null;
  subject: string | null;
  snippet: string | null;
  bodyText: string | null;
  threadId: string | null;
  date: number;
  isRead: boolean;
  labelIds: string[];
  isCustomer: boolean;
  classified: boolean;
  createdAt: number;
  customerId: string | null;
  customerName: string | null;
};

export type EmailListResponse = {
  data: EmailListItem[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
};

type DataResponse<T> = { data: T };

export async function searchEmails(
  orgId: string,
  q: string,
): Promise<EmailSearchResult[]> {
  const params = new URLSearchParams({ orgId, q });
  const response = await apiFetch(`/emails/search?${params}`);
  const json: DataResponse<EmailSearchResult[]> = await response.json();
  return json.data;
}

export async function fetchEmails(
  orgId: string,
  params?: {
    search?: string;
    customerId?: string;
    isCustomer?: "true" | "false";
    category?: "primary" | "promotions" | "social" | "notifications";
    limit?: number;
    offset?: number;
  },
): Promise<EmailListResponse> {
  const query = new URLSearchParams({ orgId });
  if (params?.search) query.set("search", params.search);
  if (params?.customerId) query.set("customerId", params.customerId);
  if (params?.isCustomer) query.set("isCustomer", params.isCustomer);
  if (params?.category) query.set("category", params.category);
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.offset) query.set("offset", String(params.offset));

  const response = await apiFetch(`/emails?${query.toString()}`);
  return response.json();
}

export async function markAsCustomer(
  orgId: string,
  emailAddress: string,
  opts?: { name?: string; company?: string },
): Promise<{ customerId: string; emailsLinked: number }> {
  const response = await apiFetch("/emails/mark-customer", {
    method: "POST",
    body: JSON.stringify({ orgId, emailAddress, ...opts }),
  });
  const json: DataResponse<{ customerId: string; emailsLinked: number }> =
    await response.json();
  return json.data;
}
