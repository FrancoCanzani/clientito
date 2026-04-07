import type { Subscription, UnsubscribeResult } from "./types";

function getErrorMessage(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) return null;
  const error = Reflect.get(payload, "error");
  return typeof error === "string" ? error : null;
}

export async function fetchSubscriptions(): Promise<Subscription[]> {
  const response = await fetch("/api/inbox/subscriptions");
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(getErrorMessage(payload) ?? "Failed to fetch subscriptions");
  }

  const json: Subscription[] = await response.json();
  return json;
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
    throw new Error(getErrorMessage(payload) ?? "Failed to unsubscribe");
  }

  const json: UnsubscribeResult = await response.json();
  return json;
}
