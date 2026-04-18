import type { GmailMessage } from "../types";
import { STANDARD_LABELS } from "../types";
import { parseParticipants } from "../mailbox/participants";
import {
  extractMessageAttachments,
  extractMessageBodyHtml,
  extractMessageBodyText,
  getHeaderValue,
} from "../mailbox/read";
import {
  normalizeUnsubscribeEmail,
  normalizeUnsubscribeUrl,
} from "../subscriptions/service";

const HAS_ATTACHMENT_LABEL = "HAS_ATTACHMENT";
const CALENDAR_MIME_PREFIXES = [
  "text/calendar",
  "application/ics",
  "application/icalendar",
  "application/x-ical",
  "application/vnd.ms-outlook",
] as const;
const CALENDAR_BODY_MARKERS = [
  "begin:vcalendar",
  "begin:vevent",
  "method:request",
  "method:cancel",
  "method:reply",
] as const;

function extractAddress(headerValue: string | null): string {
  if (!headerValue) return "";
  const match = headerValue.match(/<([^>]+)>/);
  return (match?.[1] ?? headerValue).trim();
}

export type ParsedInlineAttachment = {
  contentId: string;
  attachmentId: string;
  mimeType: string | null;
  filename: string | null;
};

export type ParsedAttachment = {
  attachmentId: string;
  filename: string | null;
  mimeType: string | null;
  size: number | null;
  contentId: string | null;
  isInline: boolean;
  isImage: boolean;
};

export type ParsedEmail = {
  providerMessageId: string;
  threadId: string | null;
  messageId: string | null;
  fromAddr: string;
  fromName: string | null;
  toAddr: string | null;
  ccAddr: string | null;
  subject: string | null;
  snippet: string | null;
  bodyText: string | null;
  bodyHtml: string | null;
  date: number;
  direction: "sent" | "received";
  isRead: boolean;
  labelIds: string[];
  unsubscribeUrl: string | null;
  unsubscribeEmail: string | null;
  hasCalendar: boolean;
  inlineAttachments: ParsedInlineAttachment[];
  attachments: ParsedAttachment[];
};

function isCalendarMimeType(value: string | null | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return CALENDAR_MIME_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

function isCalendarFilename(value: string | null | undefined): boolean {
  if (!value) return false;
  return value.trim().toLowerCase().endsWith(".ics");
}

function partHasCalendarSignal(part: GmailMessage["payload"]): boolean {
  if (!part) return false;
  if (isCalendarMimeType(part.mimeType) || isCalendarFilename(part.filename)) {
    return true;
  }
  for (const child of part.parts ?? []) {
    if (partHasCalendarSignal(child)) return true;
  }
  return false;
}

function bodyHasCalendarSignal(value: string | null | undefined): boolean {
  if (!value) return false;
  const normalized = value.toLowerCase();
  return CALENDAR_BODY_MARKERS.some((marker) => normalized.includes(marker));
}

/**
 * Parse a Gmail API message into a flat email object ready for local storage.
 * Pure function — no D1 or external dependencies.
 *
 * Returns null if the message can't be parsed (missing payload, missing sender, etc.).
 */
export function parseGmailMessage(
  message: GmailMessage,
  options?: { minDateMs?: number | null },
): ParsedEmail | null {
  const internalDate = Number(message.internalDate ?? "");
  const normalizedDate =
    Number.isFinite(internalDate) && internalDate > 0 ? internalDate : null;

  if (
    typeof options?.minDateMs === "number" &&
    normalizedDate !== null &&
    normalizedDate < options.minDateMs
  ) {
    return null;
  }

  if (!message.payload) return null;

  const rawFrom = getHeaderValue(message.payload.headers, "From");
  const rawTo = getHeaderValue(message.payload.headers, "To");
  const rawCc = getHeaderValue(message.payload.headers, "Cc");
  const rawMessageId = getHeaderValue(message.payload.headers, "Message-ID");
  const fromAddr = extractAddress(rawFrom);
  const toAddr = extractAddress(rawTo);

  if (!fromAddr) return null;

  const subject = getHeaderValue(message.payload.headers, "Subject");
  const bodyText = extractMessageBodyText(message);
  const bodyHtml = extractMessageBodyHtml(message);
  const attachments = extractMessageAttachments(message);
  const labelIds = [...(message.labelIds ?? [])];
  const hasAttachments = attachments.length > 0;
  if (hasAttachments && !labelIds.includes(HAS_ATTACHMENT_LABEL)) {
    labelIds.push(HAS_ATTACHMENT_LABEL);
  }

  const inlineAttachments: ParsedInlineAttachment[] = attachments
    .filter((a) => a.isInline && a.contentId && a.attachmentId)
    .map((a) => ({
      contentId: a.contentId!,
      attachmentId: a.attachmentId,
      mimeType: a.mimeType,
      filename: a.filename,
    }));
  const parsedAttachments: ParsedAttachment[] = attachments.map((a) => ({
    attachmentId: a.attachmentId,
    filename: a.filename,
    mimeType: a.mimeType,
    size: a.size,
    contentId: a.contentId,
    isInline: a.isInline,
    isImage: a.isImage,
  }));
  const hasCalendar =
    partHasCalendarSignal(message.payload) ||
    parsedAttachments.some(
      (attachment) =>
        isCalendarMimeType(attachment.mimeType) ||
        isCalendarFilename(attachment.filename),
    ) ||
    bodyHasCalendarSignal(bodyText) ||
    bodyHasCalendarSignal(bodyHtml);
  const isRead = !labelIds.includes(STANDARD_LABELS.UNREAD);
  const date = normalizedDate ?? Date.now();

  if (typeof options?.minDateMs === "number" && date < options.minDateMs) {
    return null;
  }

  const isSent = labelIds.includes(STANDARD_LABELS.SENT);
  const direction: "sent" | "received" = isSent ? "sent" : "received";

  const fromParticipants = parseParticipants(rawFrom);
  const senderParticipant =
    fromParticipants.find((p) => p.email === fromAddr.toLowerCase()) ??
    fromParticipants[0] ??
    null;
  const fromName = senderParticipant?.name ?? null;

  const rawUnsubscribe = getHeaderValue(message.payload.headers, "List-Unsubscribe");
  let unsubscribeUrl: string | null = null;
  let unsubscribeEmail: string | null = null;
  if (rawUnsubscribe) {
    const urls =
      rawUnsubscribe.match(/<([^>]+)>/g)?.map((m) => m.slice(1, -1)) ?? [];
    unsubscribeUrl = normalizeUnsubscribeUrl(
      urls.find((u) => u.startsWith("http")) ?? null,
    );
    unsubscribeEmail = normalizeUnsubscribeEmail(
      urls.find((u) => u.startsWith("mailto:")) ?? null,
    );
  }

  return {
    providerMessageId: message.id,
    threadId: message.threadId ?? null,
    messageId: rawMessageId ?? null,
    fromAddr,
    fromName,
    toAddr: toAddr || null,
    ccAddr: rawCc || null,
    subject,
    snippet: message.snippet ?? null,
    bodyText: bodyText || null,
    bodyHtml: bodyHtml || null,
    date,
    direction,
    isRead,
    labelIds,
    unsubscribeUrl,
    unsubscribeEmail,
    hasCalendar,
    inlineAttachments,
    attachments: parsedAttachments,
  };
}
