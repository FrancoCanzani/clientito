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

function extractAddress(headerValue: string | null): string {
  if (!headerValue) return "";
  const match = headerValue.match(/<([^>]+)>/);
  return (match?.[1] ?? headerValue).trim();
}

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
};

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
  const labelIds = [...(message.labelIds ?? [])];
  const hasAttachments = extractMessageAttachments(message).length > 0;
  if (hasAttachments && !labelIds.includes(HAS_ATTACHMENT_LABEL)) {
    labelIds.push(HAS_ATTACHMENT_LABEL);
  }
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
  };
}
