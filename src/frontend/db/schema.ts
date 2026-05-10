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
  bodyText: string | null;
  bodyHtml: string | null;
  date: number;
  direction: EmailDirection | null;
  isRead: boolean;
  labelIds: string | null;
  hasInbox: boolean;
  hasSent: boolean;
  hasTrash: boolean;
  hasSpam: boolean;
  hasStarred: boolean;
  unsubscribeUrl: string | null;
  unsubscribeEmail: string | null;
  snoozedUntil: number | null;
  inlineAttachments: string | null;
  attachments: string | null;
  hasCalendar: boolean;
  isGatekept: boolean;
  aiSummary: string | null;
  aiDraftReply: string | null;
  aiSplitIds: string | null;
  createdAt: number;
};

export type EmailInsert = Omit<EmailRow, "id"> & { id?: number };

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
