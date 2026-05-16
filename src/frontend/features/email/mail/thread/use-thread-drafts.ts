import { localDb } from "@/db/client";
import { getCurrentUserId } from "@/db/user";
import { useAuth } from "@/hooks/use-auth";
import {
 getMailboxDisplayEmail,
 useMailboxes,
} from "@/hooks/use-mailboxes";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import type { EmailThreadItem } from "@/features/email/mail/shared/types";

function stripHtmlToText(html: string): string {
 if (!html) return "";
 if (typeof DOMParser === "undefined") {
 return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
 }
 try {
 return (
 new DOMParser()
 .parseFromString(html, "text/html")
 .body.textContent?.replace(/\s+/g, " ")
 .trim() ?? ""
 );
 } catch {
 return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
 }
}

export function useThreadDrafts(
 threadId: string | null | undefined,
 mailboxId: number | null | undefined,
): EmailThreadItem[] {
 const { user } = useAuth();
 const mailboxesQuery = useMailboxes();
 const activeMailbox = useMemo(
 () =>
 mailboxesQuery.data?.accounts.find(
 (entry) => entry.mailboxId === mailboxId,
 ) ?? null,
 [mailboxesQuery.data?.accounts, mailboxId],
 );

 const draftsQuery = useQuery({
 queryKey: ["thread-drafts", threadId ?? "none"],
 enabled: Boolean(threadId),
 staleTime: 30_000,
 queryFn: async () => {
 const userId = await getCurrentUserId();
 if (!userId || !threadId) return [];
 return localDb.getDraftsByThreadId(userId, threadId);
 },
 });

 return useMemo<EmailThreadItem[]>(() => {
 const drafts = draftsQuery.data ?? [];
 if (drafts.length === 0) return [];
 const fromAddr =
 (activeMailbox ? getMailboxDisplayEmail(activeMailbox) : null) ??
 user?.email ??
 "";
 const fromName = user?.name ?? null;
 return drafts.map((draft) => ({
 id: `draft-${draft.id}`,
 mailboxId: draft.mailboxId ?? mailboxId ?? null,
 providerMessageId: `draft-${draft.id}`,
 fromAddr,
 fromName,
 toAddr: draft.toAddr || null,
 ccAddr: draft.ccAddr || null,
 subject: draft.subject || null,
 snippet: stripHtmlToText(draft.body).slice(0, 200) || null,
 threadId: draft.threadId ?? threadId ?? null,
 date: draft.updatedAt,
 direction: "sent",
 isRead: true,
 labelIds: ["DRAFT"],
 hasAttachment: (draft.attachmentKeys?.length ?? 0) > 0,
 hasCalendar: false,
 isGatekept: false,
 createdAt: draft.createdAt,
 unsubscribeUrl: null,
 unsubscribeEmail: null,
 snoozedUntil: null,
 bodyText: stripHtmlToText(draft.body),
 bodyHtml: draft.body,
 resolvedBodyHtml: draft.body,
 resolvedBodyText: stripHtmlToText(draft.body),
 attachments: [],
 inlineAttachments: [],
 isDraft: true,
 draftId: draft.id,
 draftComposeKey: draft.composeKey,
 }));
 }, [draftsQuery.data, activeMailbox, user?.email, user?.name, mailboxId, threadId]);
}
