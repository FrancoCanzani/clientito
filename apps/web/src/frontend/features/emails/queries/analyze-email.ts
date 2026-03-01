import type { EmailAnalysis } from "../types";

export async function analyzeEmail(
  orgId: string,
  emailId: string,
): Promise<EmailAnalysis> {
  const params = new URLSearchParams({ orgId, emailId });
  const response = await fetch(`/api/emails/analyze?${params}`, {
    credentials: "include",
  });
  const json = await response.json();
  return json.data;
}
