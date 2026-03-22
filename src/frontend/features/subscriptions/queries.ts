import type { Subscription, UnsubscribeResult } from "./types";

export async function fetchSubscriptions(): Promise<Subscription[]> {
  const response = await fetch("/api/inbox/subscriptions");
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const message =
      payload && typeof payload.error === "string"
        ? payload.error
        : "Failed to fetch subscriptions";
    throw new Error(message);
  }

  const json = (await response.json()) as { data: Subscription[] };
  return json.data;
}

export async function unsubscribe(input: {
  fromAddr: string;
  unsubscribeUrl?: string;
  unsubscribeEmail?: string;
}): Promise<UnsubscribeResult> {
  const response = await fetch("/api/inbox/subscriptions/unsubscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const message =
      payload && typeof payload.error === "string"
        ? payload.error
        : "Failed to unsubscribe";
    throw new Error(message);
  }

  const json = (await response.json()) as { data: UnsubscribeResult };
  return json.data;
}
