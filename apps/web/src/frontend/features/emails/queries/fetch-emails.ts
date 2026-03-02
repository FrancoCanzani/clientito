import type { EmailListResponse } from "../types";

export type FetchEmailsParams = {
  search?: string;
  isRead?: "true" | "false";
  category?: "primary" | "promotions" | "social" | "notifications";
  view?: "inbox" | "sent" | "spam" | "trash" | "all";
  limit?: number;
  offset?: number;
};

export async function fetchEmails(
  params?: FetchEmailsParams,
): Promise<EmailListResponse> {
  const query = new URLSearchParams();
  if (params?.search) query.set("search", params.search);
  if (params?.isRead) query.set("isRead", params.isRead);
  if (params?.category) query.set("category", params.category);
  if (params?.view) query.set("view", params.view);
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.offset) query.set("offset", String(params.offset));

  const response = await fetch(`/api/emails?${query}`, {
    credentials: "include",
  });

  return response.json();
}
