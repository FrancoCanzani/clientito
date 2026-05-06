import type {
  ComposeInitial,
  EmailDetailItem,
  EmailListItem,
} from "../types";
import { formatQuotedDate } from "./formatters";

export function buildReplySubject(subject: string | null): string {
  if (!subject) return "Re:";
  return `Re: ${subject.replace(/^Re:\s*/i, "")}`;
}

export function buildReplyInitial(
  email: EmailListItem,
  detail?: EmailDetailItem | null,
): ComposeInitial {
  const originalFrom = email.fromName
    ? `${email.fromName} &lt;${email.fromAddr}&gt;`
    : email.fromAddr;
  const originalDate = formatQuotedDate(email.date);
  const originalBody =
    detail?.resolvedBodyHtml ?? detail?.resolvedBodyText ?? email.snippet ?? "";
  const quotedHtml = `<div data-forwarded-message="true"><div data-forwarded-header>On ${originalDate}, ${originalFrom} wrote:</div><div data-forwarded-original-body>${originalBody}</div></div>`;

  return {
    mailboxId: email.mailboxId,
    to: email.fromAddr,
    subject: buildReplySubject(email.subject),
    bodyHtml: quotedHtml,
    threadId: email.threadId ?? undefined,
    composeKey: `reply_${email.id}`,
  };
}

export function pickReplySource<T extends EmailListItem>(
  fallback: T,
  threadMessages: T[],
  selfEmails: Set<string>,
): T {
  const sorted = [...threadMessages].sort((left, right) => {
    if (right.date !== left.date) return right.date - left.date;
    return right.createdAt - left.createdAt;
  });

  return (
    sorted.find((message) => !selfEmails.has(message.fromAddr.toLowerCase())) ??
    sorted[0] ??
    fallback
  );
}
