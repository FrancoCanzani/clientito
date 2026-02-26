import { apiFetch } from "@/lib/api";

export type EmailSearchResult = {
  id: string;
  gmailId: string;
  fromAddr: string;
  toAddr: string | null;
  subject: string | null;
  snippet: string | null;
  date: number;
  isCustomer: boolean;
  customerId: string | null;
  customerName: string | null;
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
