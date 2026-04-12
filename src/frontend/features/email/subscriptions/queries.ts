import type { BulkUnsubscribeResult, Subscription, SubscriptionSuggestions, UnsubscribeResult } from "./types";

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

export async function fetchSuggestions(): Promise<SubscriptionSuggestions> {
  const response = await fetch("/api/inbox/subscriptions/suggestions");
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(getErrorMessage(payload) ?? "Failed to fetch suggestions");
  }

  const json: SubscriptionSuggestions = await response.json();
  return json;
}

export async function unsubscribe(input: {
  fromAddr: string;
  unsubscribeUrl?: string;
  unsubscribeEmail?: string;
  trashExisting?: boolean;
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

export async function bulkUnsubscribe(input: {
  items: { fromAddr: string; unsubscribeUrl?: string; unsubscribeEmail?: string }[];
  trashExisting?: boolean;
}): Promise<BulkUnsubscribeResult> {
  const response = await fetch("/api/inbox/subscriptions/bulk-unsubscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(getErrorMessage(payload) ?? "Failed to bulk unsubscribe");
  }

  const json: BulkUnsubscribeResult = await response.json();
  return json;
}
