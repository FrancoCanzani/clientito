import type { EmailDetailItem } from "../types";

export async function fetchEmailDetail(
  emailId: string,
  options?: { refreshLive?: boolean },
): Promise<EmailDetailItem> {
  const params = new URLSearchParams();
  if (options?.refreshLive) {
    params.set("refreshLive", "true");
  }

  const suffix = params.size > 0 ? `?${params.toString()}` : "";
  const response = await fetch(`/api/emails/${emailId}${suffix}`);
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
