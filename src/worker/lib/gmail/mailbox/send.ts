import type { Database } from "../../../db/client";
import { GMAIL_API_BASE, getGmailTokenForMailbox } from "../client";
import type { GoogleOAuthConfig } from "../types";

function encodeBase64Url(input: string): string {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(input);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function encodeMimeHeader(value: string): string {
  if (!/[^\x20-\x7E]/.test(value)) {
    return value;
  }

  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return `=?UTF-8?B?${btoa(binary)}?=`;
}

function postGmailModify(
  accessToken: string,
  path: string,
  body: {
    ids?: string[];
    addLabelIds?: string[];
    removeLabelIds?: string[];
  },
): Promise<void> {
  if (!body.addLabelIds?.length && !body.removeLabelIds?.length) {
    return Promise.resolve();
  }

  return fetch(`${GMAIL_API_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  }).then(async (response) => {
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(
        `Gmail modify failed (${response.status}): ${text || response.statusText}`,
      );
    }
  });
}

function buildMimeMessage(
  input: {
    to: string;
    cc?: string;
    bcc?: string;
    subject: string;
    body: string;
    inReplyTo?: string;
    references?: string;
    threadId?: string;
    attachments?: Array<{
      filename: string;
      mimeType: string;
      content: ArrayBuffer;
    }>;
  },
  fromAddr: string,
): string {
  const hasAttachments = input.attachments && input.attachments.length > 0;

  const headers: string[] = [];
  headers.push(`From: ${fromAddr}`);
  headers.push(`To: ${input.to}`);
  if (input.cc) {
    headers.push(`Cc: ${input.cc}`);
  }
  if (input.bcc) {
    headers.push(`Bcc: ${input.bcc}`);
  }
  headers.push(`Subject: ${encodeMimeHeader(input.subject)}`);
  headers.push("MIME-Version: 1.0");

  if (input.inReplyTo) {
    headers.push(`In-Reply-To: ${input.inReplyTo}`);
  }
  if (input.references) {
    headers.push(`References: ${input.references}`);
  }

  if (!hasAttachments) {
    headers.push('Content-Type: text/html; charset="UTF-8"');
    headers.push("");
    headers.push(input.body);
    return headers.join("\r\n");
  }

  const boundary = `boundary_${crypto.randomUUID().replace(/-/g, "")}`;
  headers.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
  headers.push("");
  headers.push(`--${boundary}`);
  headers.push('Content-Type: text/html; charset="UTF-8"');
  headers.push("");
  headers.push(input.body);

  const attachments = input.attachments ?? [];
  for (const attachment of attachments) {
    headers.push(`--${boundary}`);
    headers.push(
      `Content-Type: ${attachment.mimeType}; name="${attachment.filename}"`,
    );
    headers.push("Content-Transfer-Encoding: base64");
    headers.push(
      `Content-Disposition: attachment; filename="${attachment.filename}"`,
    );
    headers.push("");
    headers.push(arrayBufferToBase64(attachment.content));
  }

  headers.push(`--${boundary}--`);
  return headers.join("\r\n");
}

export async function sendGmailMessage(
  db: Database,
  env: Env,
  mailboxId: number,
  userEmail: string,
  input: {
    to: string;
    cc?: string;
    bcc?: string;
    subject: string;
    body: string;
    inReplyTo?: string;
    references?: string;
    threadId?: string;
    attachments?: Array<{
      filename: string;
      mimeType: string;
      content: ArrayBuffer;
    }>;
  },
): Promise<{ gmailId: string; threadId: string }> {
  const accessToken = await getGmailTokenForMailbox(db, mailboxId, {
    GOOGLE_CLIENT_ID: env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: env.GOOGLE_CLIENT_SECRET,
  });

  const raw = buildMimeMessage(input, userEmail);
  const encodedRaw = encodeBase64Url(raw);

  const requestBody: Record<string, string> = { raw: encodedRaw };
  if (input.threadId) {
    requestBody.threadId = input.threadId;
  }

  const response = await fetch(`${GMAIL_API_BASE}/messages/send`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `Gmail send failed (${response.status}): ${body || response.statusText}`,
    );
  }

  const result = (await response.json()) as { id: string; threadId: string };
  return { gmailId: result.id, threadId: result.threadId };
}

export async function batchModifyGmailMessages(
  db: Database,
  mailboxId: number,
  env: GoogleOAuthConfig,
  gmailMessageIds: string[],
  addLabelIds?: string[],
  removeLabelIds?: string[],
): Promise<void> {
  const ids = Array.from(new Set(gmailMessageIds.filter(Boolean)));
  if (ids.length === 0) {
    return;
  }

  const accessToken = await getGmailTokenForMailbox(db, mailboxId, env);
  await postGmailModify(accessToken, "/messages/batchModify", {
    ids,
    addLabelIds: addLabelIds?.length ? Array.from(new Set(addLabelIds)) : [],
    removeLabelIds: removeLabelIds?.length
      ? Array.from(new Set(removeLabelIds))
      : [],
  });
}

export async function hardDeleteGmailMessage(
  db: Database,
  mailboxId: number,
  env: GoogleOAuthConfig,
  gmailMessageId: string,
): Promise<void> {
  if (!gmailMessageId) return;
  const accessToken = await getGmailTokenForMailbox(db, mailboxId, env);
  const response = await fetch(
    `${GMAIL_API_BASE}/messages/${encodeURIComponent(gmailMessageId)}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );
  // Gmail returns 204 on success; 404 is fine (already gone).
  if (!response.ok && response.status !== 404) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `Gmail delete failed (${response.status}): ${text || response.statusText}`,
    );
  }
}
