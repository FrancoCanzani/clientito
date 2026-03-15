import { authClient } from "@/lib/auth-client";

const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.send",
];

export async function startFullSync(
  months?: number,
  continueFullSync?: boolean,
): Promise<void> {
  const response = await fetch("/api/sync/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ months, continueFullSync }),
  });

  if (response.status === 409) return;
  if (!response.ok) {
    throw new Error("Failed to start Gmail sync.");
  }
}

export async function beginGmailConnection() {
  const result = await authClient.linkSocial({
    provider: "google",
    callbackURL: "/get-started",
    scopes: GMAIL_SCOPES,
  });

  if (result?.error) {
    throw new Error(result.error.message || "Google connection failed.");
  }
}

export async function runIncrementalSync(): Promise<void> {
  const response = await fetch("/api/sync/incremental", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });

  if (response.status === 409) return;
  if (!response.ok) {
    throw new Error("Failed to run incremental Gmail sync.");
  }
}
