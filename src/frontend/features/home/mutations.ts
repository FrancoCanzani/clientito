import { authClient } from "@/lib/auth-client";

const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/calendar.events",
];

export async function startFullSync(
  months?: number,
  mailboxId?: number,
): Promise<void> {
  const response = await fetch("/api/inbox/sync/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ months, mailboxId }),
  });

  if (response.status === 409) return;
  if (!response.ok) {
    throw new Error("Failed to start Gmail sync.");
  }
}

export async function beginGmailConnection(callbackURL = "/settings") {
  const result = await authClient.linkSocial({
    provider: "google",
    callbackURL,
    scopes: GMAIL_SCOPES,
  });

  if (result?.error) {
    throw new Error(result.error.message || "Google connection failed.");
  }
}

export async function runIncrementalSync(mailboxId?: number): Promise<void> {
  const response = await fetch("/api/inbox/sync/incremental", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mailboxId }),
  });

  if (response.status === 409) return;
  if (!response.ok) {
    throw new Error("Failed to run incremental Gmail sync.");
  }
}
