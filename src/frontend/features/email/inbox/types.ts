import type { EmailView } from "./utils/inbox-filters";

export type DraftState = {
  mailboxId: number | null;
  to: string;
  cc: string;
  bcc: string;
  subject: string;
  body: string;
  forwardedContent: string;
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
  createdAt: number;
  unsubscribeUrl: string | null;
  unsubscribeEmail: string | null;
  snoozedUntil: number | null;
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

export type EmailThreadItem = EmailListItem & EmailBodySource & {
  attachments?: EmailAttachment[];
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
  attachmentKeys: Array<{
    key: string;
    filename: string;
    mimeType: string;
  }> | null;
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
};
