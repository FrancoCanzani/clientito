export type EmailSearchResult = {
  id: string;
  gmailId: string;
  fromAddr: string;
  fromName: string | null;
  toAddr: string | null;
  subject: string | null;
  snippet: string | null;
  date: number;
  isRead: boolean;
  labelIds: string[];
};

export type ContactSuggestion = {
  email: string;
  name: string | null;
  avatarUrl: string | null;
  lastInteractionAt: number | null;
  interactionCount: number;
};

export type EmailListItem = {
  id: string;
  gmailId: string;
  fromAddr: string;
  fromName: string | null;
  toAddr: string | null;
  subject: string | null;
  snippet: string | null;
  threadId: string | null;
  date: number;
  direction: "sent" | "received" | null;
  isRead: boolean;
  labelIds: string[];
  hasAttachment: boolean;
  createdAt: number;
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
