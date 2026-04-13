import type { EmailDetailItem } from "../types";
import { escapeHtml } from "./escape-html";
import { formatQuotedDate } from "./formatters";

export function buildReplyHtml(
  email: Pick<
    EmailDetailItem,
    "fromName" | "fromAddr" | "date" | "resolvedBodyHtml" | "resolvedBodyText" | "bodyText"
  >,
): string {
  const fromLabel = email.fromName
    ? `${escapeHtml(email.fromName)} &lt;${escapeHtml(email.fromAddr)}&gt;`
    : escapeHtml(email.fromAddr);
  const dateLine = formatQuotedDate(email.date);

  const originalBody =
    email.resolvedBodyHtml?.trim() ||
    email.resolvedBodyText?.trim() ||
    email.bodyText?.trim() ||
    "";

  return [
    "<p><br></p>",
    '<blockquote data-quoted-reply="true" style="border-left:2px solid #ccc;padding-left:12px;margin-left:0;color:#666">',
    `<p>On ${escapeHtml(dateLine)}, ${fromLabel} wrote:</p>`,
    originalBody,
    "</blockquote>",
  ].join("");
}
