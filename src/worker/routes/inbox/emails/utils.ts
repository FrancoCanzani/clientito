import { sql } from "drizzle-orm";
import { emails } from "../../../db/schema";
import type { AttachmentMeta } from "../../../lib/email";

const HAS_ATTACHMENT_LABEL = "HAS_ATTACHMENT";

export const emailSummarySelection = {
  id: emails.id,
  mailboxId: emails.mailboxId,
  providerMessageId: emails.providerMessageId,
  fromAddr: emails.fromAddr,
  fromName: emails.fromName,
  toAddr: emails.toAddr,
  ccAddr: emails.ccAddr,
  subject: emails.subject,
  snippet: emails.snippet,
  threadId: emails.threadId,
  date: emails.date,
  direction: emails.direction,
  isRead: emails.isRead,
  labelIds: emails.labelIds,
  aiLabel: emails.aiLabel,
  createdAt: emails.createdAt,
  unsubscribeUrl: emails.unsubscribeUrl,
  unsubscribeEmail: emails.unsubscribeEmail,
  snoozedUntil: emails.snoozedUntil,
} as const;

export function hasEmailLabel(label: string) {
  return sql<boolean>`exists(
    select 1
    from json_each(coalesce(${emails.labelIds}, '[]'))
    where value = ${label}
  )`;
}

export function toEmailListResponse(row: {
  id: number;
  mailboxId: number | null;
  providerMessageId: string;
  fromAddr: string;
  fromName: string | null;
  toAddr: string | null;
  ccAddr: string | null;
  subject: string | null;
  snippet: string | null;
  threadId: string | null;
  date: number;
  direction: "sent" | "received" | null;
  isRead: boolean;
  labelIds: string[] | null;
  aiLabel: string | null;
  createdAt: number;
  unsubscribeUrl: string | null;
  unsubscribeEmail: string | null;
  snoozedUntil: number | null;
}) {
  const labelIds = row.labelIds ?? [];
  return {
    id: String(row.id),
    mailboxId: row.mailboxId,
    providerMessageId: row.providerMessageId,
    fromAddr: row.fromAddr,
    fromName: row.fromName,
    toAddr: row.toAddr,
    ccAddr: row.ccAddr,
    subject: row.subject,
    snippet: row.snippet,
    threadId: row.threadId,
    date: row.date,
    direction: row.direction,
    isRead: row.isRead,
    labelIds,
    aiLabel: row.aiLabel,
    hasAttachment: labelIds.includes(HAS_ATTACHMENT_LABEL),
    createdAt: row.createdAt,
    unsubscribeUrl: row.unsubscribeUrl,
    unsubscribeEmail: row.unsubscribeEmail,
    snoozedUntil: row.snoozedUntil,
  };
}

export function toEmailDetailResponse(row: {
  id: number;
  mailboxId: number | null;
  providerMessageId: string;
  fromAddr: string;
  fromName: string | null;
  toAddr: string | null;
  ccAddr: string | null;
  subject: string | null;
  snippet: string | null;
  bodyText: string | null;
  bodyHtml: string | null;
  threadId: string | null;
  date: number;
  direction: "sent" | "received" | null;
  isRead: boolean;
  labelIds: string[] | null;
  aiLabel: string | null;
  createdAt: number;
  unsubscribeUrl: string | null;
  unsubscribeEmail: string | null;
  snoozedUntil: number | null;
}) {
  return {
    ...toEmailListResponse(row),
    bodyText: row.bodyText,
    bodyHtml: row.bodyHtml,
  };
}

export function normalizeMimeType(input: string | undefined): string {
  if (!input) return "application/octet-stream";
  const normalized = input.trim().toLowerCase();
  return normalized.includes("/") ? normalized : "application/octet-stream";
}

export function normalizeFilename(input: string | undefined): string | null {
  if (!input) return null;
  const normalized = input.replace(/[\r\n]/g, "").trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeCid(value: string): string {
  return value.trim().replace(/^<|>$/g, "").toLowerCase();
}

export function buildAttachmentUrl(input: {
  providerMessageId: string;
  attachmentId: string;
  filename?: string | null;
  mimeType?: string | null;
  inline?: boolean;
}): string {
  const params = new URLSearchParams({
    providerMessageId: input.providerMessageId,
    attachmentId: input.attachmentId,
  });
  if (input.filename) params.set("filename", input.filename);
  if (input.mimeType) params.set("mimeType", input.mimeType);
  if (input.inline) params.set("inline", "true");
  return `/api/inbox/emails/attachment?${params.toString()}`;
}

export function resolveInlineCidImages(
  html: string,
  providerMessageId: string,
  attachments: AttachmentMeta[],
): string {
  const inlineByCid = new Map<string, AttachmentMeta>();
  for (const attachment of attachments) {
    if (!attachment.contentId) continue;
    inlineByCid.set(normalizeCid(attachment.contentId), attachment);
  }
  if (inlineByCid.size === 0) return html;

  return html.replace(
    /\bsrc\s*=\s*(['"])cid:([^"']+)\1/gi,
    (_match, quote: string, cidValue: string) => {
      const attachment = inlineByCid.get(normalizeCid(cidValue));
      if (!attachment) return `src=${quote}cid:${cidValue}${quote}`;
      const inlineUrl = buildAttachmentUrl({
        providerMessageId,
        attachmentId: attachment.attachmentId,
        filename: attachment.filename,
        mimeType: attachment.mimeType,
        inline: true,
      });
      return `src=${quote}${inlineUrl}${quote}`;
    },
  );
}

export { HAS_ATTACHMENT_LABEL };
