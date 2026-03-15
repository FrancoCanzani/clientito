import type { Database } from "../../db/client";
import { GMAIL_API_BASE } from "./api";
import { getGmailToken } from "./token";
import type { GoogleOAuthConfig } from "./types";

type GmailModifyBody = {
  ids?: string[];
  addLabelIds?: string[];
  removeLabelIds?: string[];
};

async function postGmailModify(
  accessToken: string,
  path: string,
  body: GmailModifyBody,
  metadata: Record<string, unknown>,
): Promise<void> {
  void metadata;

  if (!body.addLabelIds?.length && !body.removeLabelIds?.length) {
    return;
  }

  const response = await fetch(`${GMAIL_API_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `Gmail modify failed (${response.status}): ${text || response.statusText}`,
    );
  }
}

async function modifyGmailMessage(
  accessToken: string,
  gmailMessageId: string,
  addLabelIds?: string[],
  removeLabelIds?: string[],
): Promise<void> {
  await postGmailModify(
    accessToken,
    `/messages/${gmailMessageId}/modify`,
    { addLabelIds, removeLabelIds },
    { gmailMessageId },
  );
}

export async function batchModifyGmailMessages(
  db: Database,
  env: GoogleOAuthConfig,
  userId: string,
  gmailMessageIds: string[],
  addLabelIds?: string[],
  removeLabelIds?: string[],
): Promise<void> {
  const ids = Array.from(new Set(gmailMessageIds.filter(Boolean)));
  if (ids.length === 0) {
    return;
  }

  const accessToken = await getGmailToken(db, userId, env);
  await postGmailModify(
    accessToken,
    "/messages/batchModify",
    {
      ids,
      addLabelIds: addLabelIds?.length ? Array.from(new Set(addLabelIds)) : [],
      removeLabelIds: removeLabelIds?.length
        ? Array.from(new Set(removeLabelIds))
        : [],
    },
    { gmailMessageIds: ids },
  );
}

export async function setGmailMessageReadState(
  db: Database,
  env: GoogleOAuthConfig,
  userId: string,
  gmailMessageId: string,
  isRead: boolean,
): Promise<void> {
  const accessToken = await getGmailToken(db, userId, env);
  if (isRead) {
    await modifyGmailMessage(accessToken, gmailMessageId, undefined, [
      "UNREAD",
    ]);
    return;
  }

  await modifyGmailMessage(accessToken, gmailMessageId, ["UNREAD"]);
}

export async function markGmailMessageRead(
  db: Database,
  env: GoogleOAuthConfig,
  userId: string,
  gmailMessageId: string,
): Promise<void> {
  await setGmailMessageReadState(db, env, userId, gmailMessageId, true);
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

export async function setGmailMessageSpamState(
  db: Database,
  env: GoogleOAuthConfig,
  userId: string,
  gmailMessageId: string,
  spam: boolean,
): Promise<void> {
  const accessToken = await getGmailToken(db, userId, env);
  if (spam) {
    await modifyGmailMessage(accessToken, gmailMessageId, ["SPAM"], [
      "INBOX",
      "TRASH",
    ]);
    return;
  }

  await modifyGmailMessage(accessToken, gmailMessageId, ["INBOX"], ["SPAM"]);
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
