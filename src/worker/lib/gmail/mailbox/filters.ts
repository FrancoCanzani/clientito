import type { Database } from "../../../db/client";
import { GMAIL_API_BASE, getGmailTokenForMailbox } from "../client";
import type { GoogleOAuthConfig } from "../types";

/**
 * Create a Gmail filter that auto-trashes any future incoming mail from the
 * given sender address. Mirrors Gmail's "Block sender" UX: filter sends
 * matching messages straight to Trash and removes them from Inbox.
 *
 * Tolerates 409 (filter already exists for this criteria).
 */
export async function createBlockSenderFilter(
  db: Database,
  mailboxId: number,
  env: GoogleOAuthConfig,
  fromEmail: string,
): Promise<void> {
  const normalized = fromEmail.trim();
  if (!normalized) return;

  const accessToken = await getGmailTokenForMailbox(db, mailboxId, env);
  const response = await fetch(`${GMAIL_API_BASE}/settings/filters`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      criteria: { from: normalized },
      action: {
        addLabelIds: ["TRASH"],
        removeLabelIds: ["INBOX", "UNREAD"],
      },
    }),
  });

  if (!response.ok && response.status !== 409) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `Gmail create filter failed (${response.status}): ${text || response.statusText}`,
    );
  }
}

export async function senderHasGmailHistory(
  db: Database,
  mailboxId: number,
  env: GoogleOAuthConfig,
  sender: string,
): Promise<boolean> {
  const normalized = sender.trim();
  if (!normalized) return false;

  const accessToken = await getGmailTokenForMailbox(db, mailboxId, env);
  const url = new URL(`${GMAIL_API_BASE}/messages`);
  url.searchParams.set("q", `from:${normalized} OR to:${normalized}`);
  url.searchParams.set("maxResults", "1");

  const response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `Gmail history check failed (${response.status}): ${text || response.statusText}`,
    );
  }

  const data = (await response.json()) as {
    messages?: Array<{ id: string }>;
  };
  return Boolean(data.messages && data.messages.length > 0);
}

export async function listMessageIdsFromSender(
  db: Database,
  mailboxId: number,
  env: GoogleOAuthConfig,
  fromEmail: string,
  maxPages = 5,
): Promise<string[]> {
  const normalized = fromEmail.trim();
  if (!normalized) return [];

  const accessToken = await getGmailTokenForMailbox(db, mailboxId, env);
  const ids: string[] = [];
  let pageToken: string | undefined;

  for (let page = 0; page < maxPages; page++) {
    const url = new URL(`${GMAIL_API_BASE}/messages`);
    url.searchParams.set("q", `from:${normalized}`);
    url.searchParams.set("maxResults", "500");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(
        `Gmail list messages failed (${response.status}): ${text || response.statusText}`,
      );
    }

    const data = (await response.json()) as {
      messages?: Array<{ id: string }>;
      nextPageToken?: string;
    };

    for (const m of data.messages ?? []) {
      if (m.id) ids.push(m.id);
    }
    pageToken = data.nextPageToken;
    if (!pageToken) break;
  }

  return ids;
}
