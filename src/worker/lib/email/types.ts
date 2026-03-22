type StandardLabel =
  | "INBOX"
  | "SENT"
  | "TRASH"
  | "SPAM"
  | "STARRED"
  | "UNREAD";

export const STANDARD_LABELS: Record<StandardLabel, string> = {
  INBOX: "INBOX",
  SENT: "SENT",
  TRASH: "TRASH",
  SPAM: "SPAM",
  STARRED: "STARRED",
  UNREAD: "UNREAD",
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
  }>;
};

export type SendResult = {
  providerMessageId: string;
  threadId?: string;
};

export interface EmailProvider {
  fetchMessage(messageId: string): Promise<RawMessage>;
  fetchAttachment(messageId: string, attachmentId: string): Promise<Uint8Array>;
  send(fromEmail: string, params: SendParams): Promise<SendResult>;
  modifyLabels(
    messageIds: string[],
    addLabelIds: string[],
    removeLabelIds: string[],
  ): Promise<void>;
  syncMessages(userId: string): Promise<void>;
  syncMessageIds(
    userId: string,
    messageIds: string[],
    forceFull?: boolean,
  ): Promise<void>;
  isReconnectError(error: unknown): boolean;
}
