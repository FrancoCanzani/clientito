export type EmailDirection = "sent" | "received";

export type EmailRow = {
  id: number;
  userId: string;
  mailboxId: number | null;
  providerMessageId: string;
  threadId: string | null;
  fromAddr: string;
  fromName: string | null;
  toAddr: string | null;
  ccAddr: string | null;
  subject: string | null;
  snippet: string | null;
  date: number;
  direction: EmailDirection | null;
  isRead: number;
  labelIds: string | null;
  hasInbox: number;
  hasSent: number;
  hasTrash: number;
  hasSpam: number;
  hasStarred: number;
  unsubscribeUrl: string | null;
  unsubscribeEmail: string | null;
  snoozedUntil: number | null;
  hasCalendar: number;
  isGatekept: number;
  createdAt: number;
  threadCount?: number | null;
};

export type EmailBodyRow = {
  bodyText: string | null;
  bodyHtml: string | null;
  preparedBodyHtml: string | null;
  inlineAttachments: string | null;
  attachments: string | null;
};

export type EmailInsert = {
  id?: number;
  userId: string;
  mailboxId: number | null;
  providerMessageId: string;
  threadId: string | null;
  fromAddr: string;
  fromName: string | null;
  toAddr: string | null;
  ccAddr: string | null;
  subject: string | null;
  snippet: string | null;
  bodyText: string | null;
  bodyHtml: string | null;
  preparedBodyHtml: string | null;
  date: number;
  direction: EmailDirection | null;
  isRead: boolean | null;
  labelIds: string | string[] | null;
  hasInbox: boolean | null;
  hasSent: boolean | null;
  hasTrash: boolean | null;
  hasSpam: boolean | null;
  hasStarred: boolean | null;
  unsubscribeUrl: string | null;
  unsubscribeEmail: string | null;
  snoozedUntil: number | null;
  inlineAttachments: string | null;
  attachments: string | null;
  hasCalendar: boolean | null;
  isGatekept: boolean | null;
  createdAt: number;
};

export type LabelType = "system" | "user";

export type LabelRow = {
  gmailId: string;
  userId: string;
  mailboxId: number;
  name: string;
  type: LabelType;
  textColor: string | null;
  backgroundColor: string | null;
  messagesTotal: number;
  messagesUnread: number;
  syncedAt: number;
};

export type LabelInsert = LabelRow;

export type SplitRule = {
  domains?: string[];
  senders?: string[];
  recipients?: string[];
  subjectContains?: string[];
  hasAttachment?: boolean | null;
  fromMailingList?: boolean | null;
  gmailLabels?: string[];
};

export type SplitViewRow = {
  id: string;
  userId: string;
  name: string;
  description: string;
  icon: string | null;
  color: string | null;
  position: number;
  visible: boolean;
  pinned: boolean;
  isSystem: boolean;
  systemKey: string | null;
  rules: SplitRule | null;
  matchMode: "rules";
  showInOther: boolean;
  createdAt: number;
  updatedAt: number;
};

export type DraftAttachmentKey = {
  key: string;
  filename: string;
  mimeType: string;
  size?: number;
  disposition?: "attachment" | "inline";
  contentId?: string;
};

export type DraftRow = {
  id: number;
  userId: string;
  composeKey: string;
  mailboxId: number | null;
  toAddr: string;
  ccAddr: string;
  bccAddr: string;
  subject: string;
  body: string;
  forwardedContent: string;
  threadId: string | null;
  attachmentKeys: string | null;
  updatedAt: number;
  createdAt: number;
};
