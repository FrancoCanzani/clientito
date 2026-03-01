import type { EmailSearchResult } from "../types";

export async function searchEmails(
  orgId: string,
  q: string,
): Promise<EmailSearchResult[]> {
  const params = new URLSearchParams({ orgId, q });
  const response = await fetch(`/api/emails/search?${params}`, {
    credentials: "include",
  });
  const json = await response.json();
  return json.data;
}
