import { emailQueryKeys } from "@/features/email/mail/shared/query-keys";
import type {
 EmailListItem,
 EmailListPage,
 EmailThreadItem,
} from "@/features/email/mail/shared/types";
import { isEmailListInfiniteData } from "@/features/email/mail/list/email-list-cache";
import type { InfiniteData, QueryClient } from "@tanstack/react-query";

export type OptimisticSendInput = {
 mailboxId: number;
 fromAddr: string;
 fromName: string | null;
 to: string;
 cc?: string;
 bcc?: string;
 subject: string;
 body: string;
 threadId?: string;
 hasAttachment: boolean;
};

function stripHtmlToText(html: string): string {
 if (!html) return "";
 if (typeof DOMParser === "undefined") {
 return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
 }
 try {
 const doc = new DOMParser().parseFromString(html, "text/html");
 return (doc.body.textContent ?? "").replace(/\s+/g, " ").trim();
 } catch {
 return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
 }
}

export function makeOptimisticProviderId(): string {
 return `optimistic-${Date.now().toString(36)}-${Math.random()
 .toString(36)
 .slice(2, 8)}`;
}

export function buildOptimisticSentItem(
 input: OptimisticSendInput,
 providerMessageId: string,
): EmailListItem {
 const now = Date.now();
 const snippet = stripHtmlToText(input.body).slice(0, 200);
 const threadId = input.threadId ?? `optimistic-thread-${providerMessageId}`;
 return {
 id: providerMessageId,
 mailboxId: input.mailboxId,
 providerMessageId,
 fromAddr: input.fromAddr,
 fromName: input.fromName,
 toAddr: input.to,
 ccAddr: input.cc ?? null,
 subject: input.subject,
 snippet,
 threadId,
 date: now,
 direction: "sent",
 isRead: true,
 labelIds: ["SENT"],
 hasAttachment: input.hasAttachment,
 hasCalendar: false,
 isGatekept: false,
 createdAt: now,
 unsubscribeUrl: null,
 unsubscribeEmail: null,
 snoozedUntil: null,
 };
}

export function buildOptimisticThreadItem(
 input: OptimisticSendInput,
 base: EmailListItem,
): EmailThreadItem {
 return {
 ...base,
 bodyText: stripHtmlToText(input.body),
 bodyHtml: input.body,
 resolvedBodyHtml: input.body,
 resolvedBodyText: stripHtmlToText(input.body),
 attachments: [],
 inlineAttachments: [],
 };
}

export function insertOptimisticIntoSentList(
 queryClient: QueryClient,
 mailboxId: number,
 item: EmailListItem,
): void {
 queryClient.setQueriesData<InfiniteData<EmailListPage>>(
 { queryKey: emailQueryKeys.list("sent", mailboxId) },
 (data) => {
 if (!isEmailListInfiniteData(data)) return data;
 const [firstPage, ...rest] = data.pages;
 if (!firstPage) {
 return {
 ...data,
 pages: [{ emails: [item], cursor: null }],
 };
 }
 return {
 ...data,
 pages: [
 { ...firstPage, emails: [item, ...firstPage.emails] },
 ...rest,
 ],
 };
 },
 );
}

export function removeOptimisticFromSentList(
 queryClient: QueryClient,
 mailboxId: number,
 providerMessageId: string,
): void {
 queryClient.setQueriesData<InfiniteData<EmailListPage>>(
 { queryKey: emailQueryKeys.list("sent", mailboxId) },
 (data) => {
 if (!isEmailListInfiniteData(data)) return data;
 return {
 ...data,
 pages: data.pages.map((page) => ({
 ...page,
 emails: page.emails.filter(
 (email) => email.providerMessageId !== providerMessageId,
 ),
 })),
 };
 },
 );
}

export function insertOptimisticIntoThread(
 queryClient: QueryClient,
 threadId: string,
 item: EmailThreadItem,
): void {
 queryClient.setQueryData<EmailThreadItem[]>(
 emailQueryKeys.thread(threadId),
 (current) => {
 if (!Array.isArray(current)) return current;
 return [...current, item];
 },
 );
}

export function removeOptimisticFromThread(
 queryClient: QueryClient,
 threadId: string,
 providerMessageId: string,
): void {
 queryClient.setQueryData<EmailThreadItem[]>(
 emailQueryKeys.thread(threadId),
 (current) => {
 if (!Array.isArray(current)) return current;
 return current.filter(
 (item) => item.providerMessageId !== providerMessageId,
 );
 },
 );
}
