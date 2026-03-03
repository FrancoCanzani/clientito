import type { Database } from "../../db/client";
import { getGmailToken } from "./token";

const GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

type SendMessageInput = {
  to: string;
  subject: string;
  body: string;
  inReplyTo?: string;
  references?: string;
  threadId?: string;
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

function buildMimeMessage(input: SendMessageInput, fromAddr: string): string {
  const lines: string[] = [];
  lines.push(`From: ${fromAddr}`);
  lines.push(`To: ${input.to}`);
  lines.push(`Subject: ${input.subject}`);
  lines.push("MIME-Version: 1.0");
  lines.push('Content-Type: text/html; charset="UTF-8"');

  if (input.inReplyTo) {
    lines.push(`In-Reply-To: ${input.inReplyTo}`);
  }
  if (input.references) {
    lines.push(`References: ${input.references}`);
  }

  lines.push("");
  lines.push(input.body);

  return lines.join("\r\n");
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
