import type { Database } from "../../db/client";
import { getGmailToken } from "./token";

const GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

type AttachmentData = {
  filename: string;
  mimeType: string;
  content: ArrayBuffer;
};

type SendMessageInput = {
  to: string;
  subject: string;
  body: string;
  inReplyTo?: string;
  references?: string;
  threadId?: string;
  attachments?: AttachmentData[];
};

type SendMessageResult = {
  gmailId: string;
  threadId: string;
};

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

function buildMimeMessage(input: SendMessageInput, fromAddr: string): string {
  const hasAttachments =
    input.attachments && input.attachments.length > 0;

  const headers: string[] = [];
  headers.push(`From: ${fromAddr}`);
  headers.push(`To: ${input.to}`);
  headers.push(`Subject: ${input.subject}`);
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
  headers.push(
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
  );
  headers.push("");
  headers.push(`--${boundary}`);
  headers.push('Content-Type: text/html; charset="UTF-8"');
  headers.push("");
  headers.push(input.body);

  for (const attachment of input.attachments!) {
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

export async function fetchAttachmentFromR2(
  env: Env,
  key: string,
): Promise<ArrayBuffer> {
  const object = await env.ATTACHMENTS.get(key);
  if (!object) throw new Error(`Attachment not found: ${key}`);
  return object.arrayBuffer();
}

export async function sendGmailMessage(
  db: Database,
  env: Env,
  userId: string,
  userEmail: string,
  input: SendMessageInput,
): Promise<SendMessageResult> {
  const accessToken = await getGmailToken(db, userId, {
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
