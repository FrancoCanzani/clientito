import { GMAIL_API_BASE } from "./api";
import type { Database } from "../../db/client";
import type { GoogleOAuthConfig } from "./types";
import { getGmailToken } from "./token";

async function modifyGmailMessage(
  accessToken: string,
  gmailMessageId: string,
  addLabelIds?: string[],
  removeLabelIds?: string[],
): Promise<void> {
  const body: Record<string, string[]> = {};
  if (addLabelIds?.length) body.addLabelIds = addLabelIds;
  if (removeLabelIds?.length) body.removeLabelIds = removeLabelIds;

  const response = await fetch(
    `${GMAIL_API_BASE}/messages/${gmailMessageId}/modify`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    console.warn("Gmail modify failed", {
      gmailMessageId,
      status: response.status,
      body: text,
    });
  }
}

export async function markGmailMessageRead(
  db: Database,
  env: GoogleOAuthConfig,
  userId: string,
  gmailMessageId: string,
): Promise<void> {
  const accessToken = await getGmailToken(db, userId, env);
  await modifyGmailMessage(accessToken, gmailMessageId, undefined, ["UNREAD"]);
}

export async function archiveGmailMessage(
  db: Database,
  env: GoogleOAuthConfig,
  userId: string,
  gmailMessageId: string,
): Promise<void> {
  const accessToken = await getGmailToken(db, userId, env);
  await modifyGmailMessage(accessToken, gmailMessageId, undefined, ["INBOX"]);
}

export async function trashGmailMessage(
  db: Database,
  env: GoogleOAuthConfig,
  userId: string,
  gmailMessageId: string,
): Promise<void> {
  const accessToken = await getGmailToken(db, userId, env);
  await modifyGmailMessage(accessToken, gmailMessageId, ["TRASH"]);
}

export async function starGmailMessage(
  db: Database,
  env: GoogleOAuthConfig,
  userId: string,
  gmailMessageId: string,
  starred: boolean,
): Promise<void> {
  const accessToken = await getGmailToken(db, userId, env);
  if (starred) {
    await modifyGmailMessage(accessToken, gmailMessageId, ["STARRED"]);
  } else {
    await modifyGmailMessage(accessToken, gmailMessageId, undefined, [
      "STARRED",
    ]);
  }
}
