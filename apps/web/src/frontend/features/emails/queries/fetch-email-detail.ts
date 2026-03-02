import type { EmailDetailItem } from "../types";

export async function fetchEmailDetail(
  emailId: string,
  options?: { skipLive?: boolean },
): Promise<EmailDetailItem> {
  const params = new URLSearchParams({ emailId });
  if (options?.skipLive) {
    params.set("skipLive", "true");
  }

  const response = await fetch(`/api/emails/detail?${params}`, {
    credentials: "include",
  });
  const json = await response.json();
  return json.data;
}
