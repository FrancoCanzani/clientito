import type {
 ComposeInitial,
 EmailBodySource,
 EmailListItem,
} from "@/features/email/mail/shared/types";
import { formatQuotedDate } from "@/features/email/mail/shared/utils/formatters";

export function buildReplySubject(subject: string | null): string {
 if (!subject) return "Re:";
 return `Re: ${subject.replace(/^Re:\s*/i, "")}`;
}

export type BuildReplyOptions = {
 replyAll?: boolean;
 selfEmails?: Set<string>;
};

function splitAddressList(value: string | null | undefined): string[] {
 if (!value) return [];
 return value
 .split(/[,;]/)
 .map((entry) => entry.trim())
 .filter(Boolean);
}

function extractAddress(entry: string): string {
 const match = entry.match(/<([^>]+)>/);
 return (match?.[1] ?? entry).trim();
}

function dedupeAddresses(
 entries: string[],
 exclude: Set<string>,
): string[] {
 const seen = new Set<string>();
 const result: string[] = [];
 for (const entry of entries) {
 const addr = extractAddress(entry).toLowerCase();
 if (!addr || seen.has(addr) || exclude.has(addr)) continue;
 seen.add(addr);
 result.push(entry);
 }
 return result;
}

export function buildReplyInitial(
 email: EmailListItem,
 detail?: EmailBodySource | null,
 options?: BuildReplyOptions,
): ComposeInitial {
 const originalFrom = email.fromName
 ? `${email.fromName} &lt;${email.fromAddr}&gt;`
 : email.fromAddr;
 const originalDate = formatQuotedDate(email.date);
 const originalBody =
 detail?.resolvedBodyHtml ?? detail?.resolvedBodyText ?? email.snippet ?? "";
 const quotedHtml = `<div data-forwarded-message="true"><div data-forwarded-header>On ${originalDate}, ${originalFrom} wrote:</div><div data-forwarded-original-body>${originalBody}</div></div>`;

 let to = email.fromAddr;
 let cc: string | undefined;

 if (options?.replyAll) {
 const selfEmails = options.selfEmails ?? new Set<string>();
 const exclude = new Set(selfEmails);
 exclude.add(email.fromAddr.toLowerCase());

 const ccEntries = dedupeAddresses(
 [...splitAddressList(email.toAddr), ...splitAddressList(email.ccAddr)],
 exclude,
 );
 if (ccEntries.length > 0) cc = ccEntries.join(", ");
 }

 return {
 mailboxId: email.mailboxId,
 to,
 cc,
 subject: buildReplySubject(email.subject),
 bodyHtml: quotedHtml,
 threadId: email.threadId ?? undefined,
 composeKey: `${options?.replyAll ? "reply_all" : "reply"}_${email.id}`,
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
