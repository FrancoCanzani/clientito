import type { Database } from "../../../db/client";
import { GMAIL_API_BASE, getGmailTokenForMailbox } from "../client";
import { sleep } from "../../utils";
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

const POST_MAX_RETRIES = 5;
const POST_RETRY_BASE_MS = 1_000;
const POST_RETRY_MAX_MS = 30_000;

function postRetryDelayMs(attempt: number): number {
  const exp = Math.min(POST_RETRY_MAX_MS, POST_RETRY_BASE_MS * 2 ** attempt);
  return Math.min(POST_RETRY_MAX_MS, exp + Math.floor(Math.random() * POST_RETRY_BASE_MS));
}

async function isModifyRateLimited(response: Response): Promise<boolean> {
  if (response.status === 429) return true;
  if (response.status !== 403) return false;
  const payload = await response.clone().json().catch(() => null) as
    | { error?: { status?: string; message?: string } }
    | null;
  const status = payload?.error?.status?.toLowerCase() ?? "";
  const msg = payload?.error?.message?.toLowerCase() ?? "";
  return status === "resource_exhausted" || msg.includes("rate limit") || msg.includes("quota");
}

async function postGmailModify(
  accessToken: string,
  path: string,
  body: {
    ids?: string[];
    addLabelIds?: string[];
    removeLabelIds?: string[];
  },
): Promise<void> {
  if (!body.addLabelIds?.length && !body.removeLabelIds?.length) {
    return;
  }

  const url = `${GMAIL_API_BASE}${path}`;
  const serializedBody = JSON.stringify(body);
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };

  for (let attempt = 0; attempt <= POST_MAX_RETRIES; attempt++) {
    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers,
        body: serializedBody,
        signal: AbortSignal.timeout(60_000),
      });
    } catch (error) {
      if (attempt === POST_MAX_RETRIES) throw error;
      await sleep(postRetryDelayMs(attempt));
      continue;
    }

    if (await isModifyRateLimited(response)) {
      if (attempt === POST_MAX_RETRIES) {
        throw new Error(`Gmail modify rate-limited on ${path} after ${POST_MAX_RETRIES} retries.`);
      }
      const delayMs = postRetryDelayMs(attempt);
      console.warn("Gmail API rate-limited on modify, retrying", { path, attempt: attempt + 1, delayMs, status: response.status });
      await sleep(delayMs);
      continue;
    }

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`Gmail modify failed (${response.status}): ${text || response.statusText}`);
    }
    return;
  }
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

export async function modifyGmailThread(
  db: Database,
  mailboxId: number,
  env: GoogleOAuthConfig,
  gmailThreadId: string,
  addLabelIds?: string[],
  removeLabelIds?: string[],
): Promise<void> {
  if (!gmailThreadId) return;
  const accessToken = await getGmailTokenForMailbox(db, mailboxId, env);
  await postGmailModify(
    accessToken,
    `/threads/${encodeURIComponent(gmailThreadId)}/modify`,
    {
      addLabelIds: addLabelIds?.length ? Array.from(new Set(addLabelIds)) : [],
      removeLabelIds: removeLabelIds?.length
        ? Array.from(new Set(removeLabelIds))
        : [],
    },
  );
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
  if (!response.ok && response.status !== 404) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `Gmail delete failed (${response.status}): ${text || response.statusText}`,
    );
  }
}

export async function batchDeleteGmailMessages(
  db: Database,
  mailboxId: number,
  env: GoogleOAuthConfig,
  gmailMessageIds: string[],
): Promise<void> {
  if (!gmailMessageIds.length) return;
  const accessToken = await getGmailTokenForMailbox(db, mailboxId, env);
  const response = await fetch(
    `${GMAIL_API_BASE}/messages/batchDelete`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ids: gmailMessageIds }),
    },
  );
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `Gmail batch delete failed (${response.status}): ${text || response.statusText}`,
    );
  }
}
