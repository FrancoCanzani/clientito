type StandardLabel =
  | "INBOX"
  | "SENT"
  | "TRASH"
  | "SPAM"
  | "STARRED"
  | "UNREAD"
  | "IMPORTANT";

export const STANDARD_LABELS: Record<StandardLabel, string> = {
  INBOX: "INBOX",
  SENT: "SENT",
  TRASH: "TRASH",
  SPAM: "SPAM",
  STARRED: "STARRED",
  UNREAD: "UNREAD",
  IMPORTANT: "IMPORTANT",
};

export type AttachmentMeta = {
  attachmentId: string;
  filename: string | null;
  mimeType: string | null;
  size: number | null;
  contentId: string | null;
  isInline: boolean;
  isImage: boolean;
};

export type RawMessage = {
  bodyText: string | null;
  bodyHtml: string | null;
  attachments: AttachmentMeta[];
};

export type SendParams = {
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  body: string;
  inReplyTo?: string;
  references?: string;
  threadId?: string;
  attachments?: Array<{
    filename: string;
    mimeType: string;
    content: ArrayBuffer;
    disposition?: "attachment" | "inline";
    contentId?: string;
  }>;
};

export type SendResult = {
  providerMessageId: string;
  threadId?: string;
};

export type GoogleOAuthConfig = {
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
};

export type GoogleTokenResponse = {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  error?: string;
  error_description?: string;
};

export type GmailThreadsListResponse = {
  threads?: Array<{ id: string; historyId?: string }>;
  nextPageToken?: string;
};

export type GmailThreadResponse = {
  id: string;
  historyId?: string;
  messages?: GmailMessage[];
};

export type GmailMessagePart = {
  partId?: string;
  filename?: string;
  mimeType?: string;
  body?: {
    data?: string;
    attachmentId?: string;
    size?: number;
  };
  parts?: GmailMessagePart[];
  headers?: Array<{ name?: string; value?: string }>;
};

export type GmailMessage = {
  id: string;
  threadId?: string;
  historyId?: string;
  internalDate?: string;
  snippet?: string;
  labelIds?: string[];
  payload?: GmailMessagePart;
};

export type GmailMessageFormat = "full" | "minimal" | "metadata";

export type GmailAttachmentResponse = {
  data?: string;
  size?: number;
};

export type GmailErrorResponse = {
  error?: {
    status?: string;
    message?: string;
    errors?: Array<{
      reason?: string;
      message?: string;
    }>;
  };
};

export type GmailAttachmentMeta = AttachmentMeta;

export type GmailLabelColor = {
  textColor: string;
  backgroundColor: string;
};

export type GmailLabel = {
  id: string;
  name: string;
  type: "system" | "user";
  messageListVisibility?: "show" | "hide";
  labelListVisibility?: "labelShow" | "labelShowIfUnread" | "labelHide";
  messagesTotal?: number;
  messagesUnread?: number;
  threadsTotal?: number;
  threadsUnread?: number;
  color?: GmailLabelColor;
};

export type GmailLabelsListResponse = {
  labels: GmailLabel[];
};
