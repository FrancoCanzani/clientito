import type { EmailListPage } from "@/features/email/mail/types";

export type PulledAttachment = {
  attachmentId: string;
  filename: string | null;
  mimeType: string | null;
  size: number | null;
  contentId: string | null;
  isInline: boolean;
  isImage: boolean;
};

export type PulledInlineAttachment = {
  contentId: string;
  attachmentId: string;
  mimeType: string | null;
  filename: string | null;
};

export type PulledEmail = {
  providerMessageId: string;
  threadId: string | null;
  messageId: string | null;
  fromAddr: string;
  fromName: string | null;
  toAddr: string | null;
  ccAddr: string | null;
  subject: string | null;
  snippet: string | null;
  bodyText: string | null;
  bodyHtml: string | null;
  date: number;
  direction: "sent" | "received";
  isRead: boolean;
  labelIds: string[];
  unsubscribeUrl: string | null;
  unsubscribeEmail: string | null;
  hasCalendar?: boolean;
  inlineAttachments?: PulledInlineAttachment[];
  attachments?: PulledAttachment[];
};

export type ViewPage = EmailListPage;

export type MailListFilters = {
  unread?: boolean;
  starred?: boolean;
  hasAttachment?: boolean;
};

export type LocalCursor = {
  type: "local";
  beforeDate: number;
  beforeId: number;
};
export type RemoteCursor = {
  type: "remote";
  token?: string;
};
export type DecodedCursor = LocalCursor | RemoteCursor;

export type DeltaSyncResponse = {
  status: "ok" | "noop" | "stale";
  added: PulledEmail[];
  deleted: string[];
  labelChanges: Array<{
    providerMessageId: string;
    addedLabels: string[];
    removedLabels: string[];
  }>;
  historyId: string | null;
};