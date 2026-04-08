import type { Database } from "../../../db/client";
import { getGmailTokenForMailbox, gmailRequest } from "../client";
import type {
  GmailAttachmentMeta,
  GmailAttachmentResponse,
  GmailMessage,
  GmailMessagePart,
} from "../types";

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

export function getHeaderValue(
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
  mailboxId: number,
  messageId: string,
): Promise<GmailMessage> {
  const accessToken = await getGmailTokenForMailbox(db, mailboxId, {
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
  mailboxId: number,
  messageId: string,
  attachmentId: string,
): Promise<Uint8Array> {
  const accessToken = await getGmailTokenForMailbox(db, mailboxId, {
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
