import { drafts } from "../../../db/schema";

export const DRAFT_COLUMNS = {
  id: drafts.id,
  composeKey: drafts.composeKey,
  mailboxId: drafts.mailboxId,
  to: drafts.toAddr,
  cc: drafts.ccAddr,
  bcc: drafts.bccAddr,
  subject: drafts.subject,
  body: drafts.body,
  forwardedContent: drafts.forwardedContent,
  threadId: drafts.threadId,
  attachmentKeys: drafts.attachmentKeys,
  updatedAt: drafts.updatedAt,
  createdAt: drafts.createdAt,
} as const;
