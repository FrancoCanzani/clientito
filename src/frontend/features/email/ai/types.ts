import type { EmailThreadItem } from "@/features/email/mail/shared/types";

export type ThreadSummary = {
  summary: string;
};

export type ReplyDraft = {
  body: string;
  intent: "reply" | "accept" | "decline" | "follow_up" | null;
  tone: "neutral" | "warm" | "formal" | "concise" | null;
};

export type SentStyleSample = {
  subject: string | null;
  bodyText: string;
};

export function toAiThreadMessages(messages: EmailThreadItem[]) {
  return messages
    .filter((message) => !message.isDraft)
    .map((message) => ({
      providerMessageId: message.providerMessageId,
      fromAddr: message.fromAddr,
      fromName: message.fromName,
      toAddr: message.toAddr,
      subject: message.subject,
      bodyText: message.bodyText ?? message.resolvedBodyText ?? null,
      snippet: message.snippet,
      date: message.date,
    }));
}

export function getLatestThreadMessage(messages: EmailThreadItem[]) {
  return [...messages]
    .filter((message) => !message.isDraft)
    .sort((left, right) =>
      right.date !== left.date
        ? right.date - left.date
        : right.createdAt - left.createdAt,
    )[0];
}
