import type { EmailDetailItem } from "../types";
import { escapeHtml } from "./escape-html";

export function buildForwardedEmailHtml(email: EmailDetailItem) {
 const fromLine = email.fromName
 ? `${escapeHtml(email.fromName)} &lt;${escapeHtml(email.fromAddr)}&gt;`
 : escapeHtml(email.fromAddr);
 const dateLine = new Date(email.date).toLocaleString();
 const subjectLine = escapeHtml(email.subject ?? "(no subject)");
 const toLine = email.toAddr?.trim() ? escapeHtml(email.toAddr) : null;
 const ccLine = email.ccAddr?.trim() ? escapeHtml(email.ccAddr) : null;
 const originalBody = email.resolvedBodyHtml?.trim().length
 ? email.resolvedBodyHtml
 : email.bodyHtml?.trim().length
 ? email.bodyHtml
 : `<div style="white-space:pre-wrap">${escapeHtml(
 email.resolvedBodyText ?? email.bodyText ?? "",
 )}</div>`;

 return [
 "<p><br></p>",
 '<div data-forwarded-message="true" style="border-top:1px solid #dadce0;margin-top:16px;padding-top:16px;color:#5f6368;font-size:13px">',
 '<div data-forwarded-header="true">---------- Forwarded message ---------</div>',
 `<div><strong>From:</strong> ${fromLine}</div>`,
 `<div><strong>Date:</strong> ${escapeHtml(dateLine)}</div>`,
 `<div><strong>Subject:</strong> ${subjectLine}</div>`,
 ...(toLine ? [`<div><strong>To:</strong> ${toLine}</div>`] : []),
 ...(ccLine ? [`<div><strong>Cc:</strong> ${ccLine}</div>`] : []),
 "<br>",
 `<div data-forwarded-original-body="true">${originalBody}</div>`,
 "</div>",
 ].join("");
}

export function buildPlainForwardedHtml(content: string) {
 return [
 '<div data-forwarded-message="true" style="border-top:1px solid #dadce0;margin-top:16px;padding-top:16px;color:#5f6368;font-size:13px">',
 '<div data-forwarded-original-body="true" style="white-space:pre-wrap">',
 escapeHtml(content),
 "</div>",
 "</div>",
 ].join("");
}
