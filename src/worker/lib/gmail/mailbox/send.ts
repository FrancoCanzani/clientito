import type { Database } from "../../../db/client";
import { gmailMutation, getGmailTokenForMailbox } from "../client";
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
      disposition?: "attachment" | "inline";
      contentId?: string;
    }>;
  },
  fromAddr: string,
): string {
  const attachments = input.attachments ?? [];
  const inlineAttachments = attachments.filter(
    (attachment) => attachment.disposition === "inline" && attachment.contentId,
  );
  const regularAttachments = attachments.filter(
    (attachment) => attachment.disposition !== "inline" || !attachment.contentId,
  );
  const hasInlineAttachments = inlineAttachments.length > 0;
  const hasRegularAttachments = regularAttachments.length > 0;

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

  if (!hasInlineAttachments && !hasRegularAttachments) {
    headers.push('Content-Type: text/html; charset="UTF-8"');
    headers.push("");
    headers.push(input.body);
    return headers.join("\r\n");
  }

  const mixedBoundary = `mixed_${crypto.randomUUID().replace(/-/g, "")}`;
  const relatedBoundary = `related_${crypto.randomUUID().replace(/-/g, "")}`;

  if (hasRegularAttachments) {
    headers.push(`Content-Type: multipart/mixed; boundary="${mixedBoundary}"`);
    headers.push("");
    headers.push(`--${mixedBoundary}`);
  }

  headers.push(
    hasInlineAttachments
      ? `Content-Type: multipart/related; boundary="${relatedBoundary}"`
      : `Content-Type: text/html; charset="UTF-8"`,
  );
  headers.push("");

  if (hasInlineAttachments) {
    headers.push(`--${relatedBoundary}`);
    headers.push('Content-Type: text/html; charset="UTF-8"');
    headers.push("");
  }

  headers.push(input.body);

  for (const attachment of inlineAttachments) {
    headers.push(`--${relatedBoundary}`);
    headers.push(
      `Content-Type: ${attachment.mimeType}; name="${attachment.filename}"`,
    );
    headers.push("Content-Transfer-Encoding: base64");
    headers.push(`Content-ID: <${attachment.contentId}>`);
    headers.push(
      `Content-Disposition: inline; filename="${attachment.filename}"`,
    );
    headers.push("");
    headers.push(arrayBufferToBase64(attachment.content));
  }

  if (hasInlineAttachments) {
    headers.push(`--${relatedBoundary}--`);
  }

  for (const attachment of regularAttachments) {
    if (hasRegularAttachments) {
      headers.push(`--${mixedBoundary}`);
    }
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

  if (hasRegularAttachments) {
    headers.push(`--${mixedBoundary}--`);
  }
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
      disposition?: "attachment" | "inline";
      contentId?: string;
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

  return gmailMutation(accessToken, "POST", "/messages/send", requestBody);
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

  const uniqueAdd = addLabelIds?.length ? Array.from(new Set(addLabelIds)) : [];
  const uniqueRemove = removeLabelIds?.length ? Array.from(new Set(removeLabelIds)) : [];
  if (!uniqueAdd.length && !uniqueRemove.length) return;

  const accessToken = await getGmailTokenForMailbox(db, mailboxId, env);
  await gmailMutation(accessToken, "POST", "/messages/batchModify", {
    ids,
    addLabelIds: uniqueAdd,
    removeLabelIds: uniqueRemove,
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
  await gmailMutation(
    accessToken,
    "POST",
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
  try {
    await gmailMutation(
      accessToken,
      "DELETE",
      `/messages/${encodeURIComponent(gmailMessageId)}`,
    );
  } catch (error) {
    if (error instanceof Error && /\(404\)/.test(error.message)) return;
    throw error;
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
  await gmailMutation(accessToken, "POST", "/messages/batchDelete", {
    ids: gmailMessageIds,
  });
}
