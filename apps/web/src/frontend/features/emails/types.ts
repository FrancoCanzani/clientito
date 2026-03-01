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
  isCustomer: boolean;
  customerId: string | null;
  customerName: string | null;
};

export type EmailListItem = {
  id: string;
  gmailId: string;
  fromAddr: string;
  fromName: string | null;
  toAddr: string | null;
  subject: string | null;
  snippet: string | null;
  bodyText: string | null;
  bodyHtml: string | null;
  threadId: string | null;
  date: number;
  isRead: boolean;
  labelIds: string[];
  hasAttachment: boolean;
  isCustomer: boolean;
  classified: boolean;
  createdAt: number;
  customerId: string | null;
  customerName: string | null;
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
  resolvedBodyText: string | null;
  resolvedBodyHtml: string | null;
  attachments: EmailAttachment[];
};

export type EmailListResponse = {
  data: EmailListItem[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
};

export type EmailAnalysis = {
  summary: string;
  sentiment: "positive" | "neutral" | "negative" | "urgent";
  suggestedTasks: Array<{ message: string; dueInDays: number }>;
  language: string;
  translation: string | null;
};

export type ActionableEmail = {
  id: string;
  fromAddr: string;
  fromName: string | null;
  subject: string | null;
  customerId: string | null;
  customerName: string | null;
};
