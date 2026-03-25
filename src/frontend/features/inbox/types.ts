export type ContactSuggestion = {
  email: string;
  name: string | null;
  avatarUrl: string | null;
  lastInteractionAt: number | null;
  interactionCount: number;
};

export type AiLabel =
  | "action_needed"
  | "important"
  | "later"
  | "newsletter"
  | "marketing"
  | "transactional"
  | "notification";

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
  aiLabel: AiLabel | null;
  hasAttachment: boolean;
  createdAt: number;
  unsubscribeUrl: string | null;
  unsubscribeEmail: string | null;
  snoozedUntil: number | null;
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
};

export type EmailListResponse = {
  data: EmailListItem[];
  pagination: {
    limit: number;
    offset: number;
    hasMore: boolean;
  };
};

export type ComposeInitial = {
  mailboxId?: number | null;
  to?: string;
  cc?: string;
  bcc?: string;
  subject?: string;
  body?: string;
  bodyHtml?: string;
};
