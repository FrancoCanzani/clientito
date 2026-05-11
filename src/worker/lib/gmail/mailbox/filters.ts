import type { Database } from "../../../db/client";
import { gmailMutation, gmailRequest, getGmailTokenForMailbox } from "../client";
import type { GoogleOAuthConfig } from "../types";

export async function createBlockSenderFilter(
  db: Database,
  mailboxId: number,
  env: GoogleOAuthConfig,
  fromEmail: string,
): Promise<void> {
  const normalized = fromEmail.trim();
  if (!normalized) return;

  const accessToken = await getGmailTokenForMailbox(db, mailboxId, env);
  try {
    await gmailMutation(accessToken, "POST", "/settings/filters", {
      criteria: { from: normalized },
      action: {
        addLabelIds: ["TRASH"],
        removeLabelIds: ["INBOX", "UNREAD"],
      },
    });
  } catch (error) {
    if (error instanceof Error && /\(409\)/.test(error.message)) return;
    throw error;
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
  const data = await gmailRequest<{ messages?: Array<{ id: string }> }>(
    accessToken,
    "/messages",
    { q: `from:${normalized} OR to:${normalized}`, maxResults: "1" },
  );
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
    const data = await gmailRequest<{
      messages?: Array<{ id: string }>;
      nextPageToken?: string;
    }>(accessToken, "/messages", {
      q: `from:${normalized}`,
      maxResults: "500",
      pageToken,
    });

    for (const m of data.messages ?? []) {
      if (m.id) ids.push(m.id);
    }
    pageToken = data.nextPageToken;
    if (!pageToken) break;
  }

  return ids;
}