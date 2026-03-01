import type { ActionableEmail } from "../types";

export async function fetchActionableEmails(
  orgId: string,
  since: number,
): Promise<ActionableEmail[]> {
  const params = new URLSearchParams({ orgId, since: String(since) });
  const response = await fetch(`/api/emails/actionable?${params}`, {
    credentials: "include",
  });
  const json = await response.json();
  return json.data;
}
