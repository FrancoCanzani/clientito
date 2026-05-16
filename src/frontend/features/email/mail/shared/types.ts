import type { DraftAttachmentKey } from "@/db/schema";
import type { EmailView } from "@/features/email/mail/shared/views";


export type DraftState = {
 mailboxId: number | null;
 to: string;
 cc: string;
 bcc: string;
 subject: string;
 body: string;
 forwardedContent: string;
 attachmentKeys: DraftAttachmentKey[];
};

export type ContactSuggestion = {
 email: string;
 name: string | null;
 avatarUrl: string | null;
 lastInteractionAt: number | null;
 interactionCount: number;
};

export type InboxSearchScope = {
 q: string;
 mailboxId?: number;
 view?: EmailView;
 includeJunk?: boolean;
};

export type InboxSearchFilterSuggestion = {
 kind: "filter";
 id: string;
 label: string;
 query: string;
 description: string | null;
};

export type InboxSearchContactSuggestion = ContactSuggestion & {
 kind: "contact";
 id: string;
 label: string;
 query: string;
 description: string | null;
};

export type InboxSearchSubjectSuggestion = {
 kind: "subject";
 id: string;
 label: string;
 query: string;
 subject: string;
 description: string | null;
 lastUsedAt: number | null;
};

export type InboxSearchSuggestionsResponse = {
 filters: InboxSearchFilterSuggestion[];
 contacts: InboxSearchContactSuggestion[];
 subjects: InboxSearchSubjectSuggestion[];
};

export type InboxUnreadCount = {
 messagesUnread: number;
 threadsUnread: number;
 syncedAt: number;
};

export type ViewUnreadCounts = {
 inbox: InboxUnreadCount;
 important: InboxUnreadCount;
};

export type EmailListItem = {
  id: string;
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
  labelIds: string[];
  hasAttachment: boolean;
  hasCalendar: boolean;
  isGatekept: boolean;
  createdAt: number;
  unsubscribeUrl: string | null;
  unsubscribeEmail: string | null;
  snoozedUntil: number | null;
  threadCount?: number;
};

export type EmailInlineAttachment = {
 contentId: string;
 attachmentId: string;
 mimeType: string | null;
 filename: string | null;
};

export type EmailBodySource = {
 bodyText: string | null;
 bodyHtml: string | null;
 resolvedBodyText?: string | null;
 resolvedBodyHtml?: string | null;
 inlineAttachments?: EmailInlineAttachment[] | null;
 providerMessageId?: string;
 mailboxId?: number | null;
};

export type EmailAttachment = {
 attachmentId: string;
 filename: string | null;
 mimeType: string | null;
 size: number | null;
 contentId: string | null;
 isInline: boolean;
 isImage: boolean;
 downloadUrl: string;
 inlineUrl: string | null;
};

export type EmailDetailItem = EmailListItem & {
 bodyText: string | null;
 bodyHtml: string | null;
 resolvedBodyText: string | null;
 resolvedBodyHtml: string | null;
 attachments: EmailAttachment[];
 inlineAttachments: EmailInlineAttachment[];
};

export type CalendarInviteResponseStatus =
 | "needsAction"
 | "accepted"
 | "declined"
 | "tentative";

export type CalendarInvitePreview = {
 uid: string;
 method: string | null;
 status: string | null;
 title: string | null;
 location: string | null;
 organizerEmail: string | null;
 startMs: number | null;
 endMs: number | null;
 startRaw: string | null;
 endRaw: string | null;
 timezone: string | null;
 selfResponseStatus: CalendarInviteResponseStatus | null;
};

export type EmailThreadItem = EmailListItem & EmailBodySource & {
 attachments?: EmailAttachment[];
 isDraft?: boolean;
 draftId?: number;
 draftComposeKey?: string;
};

export type EmailListPage = {
 emails: EmailListItem[];
 cursor: string | null;
};

export type DraftItem = {
 id: number;
 composeKey: string;
 mailboxId: number | null;
 toAddr: string;
 ccAddr: string;
 bccAddr: string;
 subject: string;
 body: string;
 forwardedContent: string;
 threadId: string | null;
 attachmentKeys: DraftAttachmentKey[] | null;
 updatedAt: number;
 createdAt: number;
};

export type ComposeInitial = {
 mailboxId?: number | null;
 to?: string;
 cc?: string;
 bcc?: string;
 subject?: string;
 body?: string;
 bodyHtml?: string;
 threadId?: string;
 composeKey?: string;
 attachmentKeys?: DraftAttachmentKey[];
};
