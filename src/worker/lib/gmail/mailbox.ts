import type { Database } from "../../db/client";
import { GMAIL_API_BASE, getGmailToken, gmailRequest } from "./client";
import type {
  GmailAttachmentMeta,
  GmailAttachmentResponse,
  GmailMessage,
  GmailMessagePart,
  GoogleOAuthConfig,
} from "./types";

export type { GmailAttachmentMeta } from "./types";

function decodeBase64UrlToBytes(input: string): Uint8Array {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (normalized.length % 4 || 4)) % 4);
  const binary = atob(`${normalized}${padding}`);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function decodeBase64Url(input: string): string {
  const bytes = decodeBase64UrlToBytes(input);
  return new TextDecoder().decode(bytes);
}

function extractBodyByMimeType(
  part: GmailMessagePart | undefined,
  mimeType: string,
): string | null {
  if (!part) {
    return null;
  }

  if (part.mimeType?.toLowerCase().startsWith(mimeType) && part.body?.data) {
    try {
      return decodeBase64Url(part.body.data);
    } catch {
      return null;
    }
  }

  for (const child of part.parts ?? []) {
    const found = extractBodyByMimeType(child, mimeType);
    if (found) {
      return found;
    }
  }

  return null;
}

function htmlToPlainText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getHeaderValue(
  headers: Array<{ name?: string; value?: string }> | undefined,
  headerName: string,
): string | null {
  if (!headers || headers.length === 0) {
    return null;
  }

  const header = headers.find(
    (entry) => entry.name?.toLowerCase() === headerName.toLowerCase(),
  );

  return header?.value?.trim() ?? null;
}

function normalizeContentId(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim().replace(/^<|>$/g, "");
  return normalized.length > 0 ? normalized : null;
}

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

function modifyGmailMessage(
  accessToken: string,
  gmailMessageId: string,
  addLabelIds?: string[],
  removeLabelIds?: string[],
): Promise<void> {
  return postGmailModify(accessToken, `/messages/${gmailMessageId}/modify`, {
    addLabelIds,
    removeLabelIds,
  });
}

function buildMimeMessage(
  input: {
    to: string;
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
  headers.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
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

export function extractMessageBodyHtml(message: GmailMessage): string | null {
  const html = extractBodyByMimeType(message.payload, "text/html");
  return html && html.trim().length > 0 ? html.trim() : null;
}

export function extractMessageBodyText(message: GmailMessage): string | null {
  const plain = extractBodyByMimeType(message.payload, "text/plain");
  if (plain && plain.trim().length > 0) {
    return plain.trim();
  }

  const html = extractBodyByMimeType(message.payload, "text/html");
  if (html && html.trim().length > 0) {
    const converted = htmlToPlainText(html);
    return converted.length > 0 ? converted : null;
  }

  return null;
}

export function extractMessageAttachments(
  message: GmailMessage,
): GmailAttachmentMeta[] {
  const attachmentsById = new Map<string, GmailAttachmentMeta>();

  function visit(part: GmailMessagePart | undefined) {
    if (!part) {
      return;
    }

    const attachmentId = part.body?.attachmentId?.trim();
    const contentId = normalizeContentId(
      getHeaderValue(part.headers, "Content-ID"),
    );
    const contentDisposition = (
      getHeaderValue(part.headers, "Content-Disposition") ?? ""
    ).toLowerCase();
    const mimeType = part.mimeType?.trim() || null;
    const isImage = mimeType?.toLowerCase().startsWith("image/") ?? false;
    const isInline =
      contentDisposition.includes("inline") || Boolean(contentId);
    const filename = part.filename?.trim() || null;
    const size =
      typeof part.body?.size === "number" ? Math.max(0, part.body.size) : null;

    if (attachmentId) {
      attachmentsById.set(attachmentId, {
        attachmentId,
        filename,
        mimeType,
        size,
        contentId,
        isInline,
        isImage,
      });
    }

    for (const child of part.parts ?? []) {
      visit(child);
    }
  }

  visit(message.payload);
  return Array.from(attachmentsById.values());
}

export async function getGmailMessageById(
  db: Database,
  env: Env,
  userId: string,
  messageId: string,
): Promise<GmailMessage> {
  const accessToken = await getGmailToken(db, userId, {
    GOOGLE_CLIENT_ID: env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: env.GOOGLE_CLIENT_SECRET,
  });

  return gmailRequest<GmailMessage>(accessToken, `/messages/${messageId}`, {
    format: "full",
    fields: "id,threadId,historyId,internalDate,snippet,labelIds,payload",
  });
}

export async function getGmailAttachmentBytes(
  db: Database,
  env: Env,
  userId: string,
  messageId: string,
  attachmentId: string,
): Promise<Uint8Array> {
  const accessToken = await getGmailToken(db, userId, {
    GOOGLE_CLIENT_ID: env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: env.GOOGLE_CLIENT_SECRET,
  });

  const payload = await gmailRequest<GmailAttachmentResponse>(
    accessToken,
    `/messages/${messageId}/attachments/${attachmentId}`,
  );

  if (!payload.data) {
    throw new Error("Attachment data missing from Gmail response.");
  }

  return decodeBase64UrlToBytes(payload.data);
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
  input: {
    to: string;
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
  await postGmailModify(accessToken, "/messages/batchModify", {
    ids,
    addLabelIds: addLabelIds?.length ? Array.from(new Set(addLabelIds)) : [],
    removeLabelIds: removeLabelIds?.length
      ? Array.from(new Set(removeLabelIds))
      : [],
  });
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
