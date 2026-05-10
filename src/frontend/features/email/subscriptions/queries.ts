export type UnsubscribeResult = {
  method: string;
  fromAddr: string;
  success: boolean;
  url?: string;
  error?: string;
  archivedCount?: number;
};

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
    const error =
      typeof payload === "object" && payload !== null
        ? Reflect.get(payload, "error")
        : undefined;
    throw new Error(
      typeof error === "string" ? error : "Failed to unsubscribe",
    );
  }

  return response.json();
}
