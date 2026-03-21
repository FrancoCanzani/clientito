import { z } from "zod";

export const errorResponseSchema = z.object({ error: z.string() });

export const emailSearchItemSchema = z.object({
  id: z.string(),
  gmailId: z.string(),
  fromAddr: z.string(),
  fromName: z.string().nullable(),
  toAddr: z.string().nullable(),
  ccAddr: z.string().nullable(),
  subject: z.string().nullable(),
  snippet: z.string().nullable(),
  date: z.number(),
  isRead: z.boolean(),
  labelIds: z.array(z.string()),
  snoozedUntil: z.number().nullable(),
});

export const searchEmailsQuerySchema = z.object({
  q: z.string().trim().min(1),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const searchEmailsResponseSchema = z.object({
  data: z.array(emailSearchItemSchema),
});

export const listEmailsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  search: z.string().trim().optional(),
  isRead: z.enum(["true", "false"]).optional(),
  view: z.enum(["inbox", "sent", "spam", "trash", "snoozed", "archived", "starred"]).optional(),
  mailboxId: z.coerce.number().int().positive().optional(),
});

export const emailListItemSchema = emailSearchItemSchema.extend({
  threadId: z.string().nullable(),
  direction: z.enum(["sent", "received"]).nullable(),
  hasAttachment: z.boolean(),
  createdAt: z.number(),
  unsubscribeUrl: z.string().nullable(),
  unsubscribeEmail: z.string().nullable(),
  snoozedUntil: z.number().nullable(),
});

export const emailAttachmentSchema = z.object({
  attachmentId: z.string(),
  filename: z.string().nullable(),
  mimeType: z.string().nullable(),
  size: z.number().nullable(),
  contentId: z.string().nullable(),
  isInline: z.boolean(),
  isImage: z.boolean(),
  downloadUrl: z.string(),
  inlineUrl: z.string().nullable(),
});

export const emailDetailParamsSchema = z.object({
  emailId: z.coerce.number().int().positive(),
});

export const emailDetailQuerySchema = z.object({
  refreshLive: z.coerce.boolean().optional(),
});

export const emailDetailResponseSchema = z.object({
  data: emailListItemSchema.extend({
    bodyText: z.string().nullable(),
    bodyHtml: z.string().nullable(),
    resolvedBodyText: z.string().nullable(),
    resolvedBodyHtml: z.string().nullable(),
    attachments: z.array(emailAttachmentSchema),
  }),
});

export const listEmailsResponseSchema = z.object({
  data: z.array(emailListItemSchema),
  pagination: z.object({
    limit: z.number(),
    offset: z.number(),
    hasMore: z.boolean(),
  }),
});

export const emailAttachmentQuerySchema = z.object({
  gmailMessageId: z.string().trim().min(1),
  attachmentId: z.string().trim().min(1),
  filename: z.string().trim().optional(),
  mimeType: z.string().trim().optional(),
  inline: z.coerce.boolean().optional(),
});

export const emailThreadParamsSchema = z.object({
  threadId: z.string().trim().min(1),
});

export const emailThreadResponseSchema = z.object({
  data: z.array(emailListItemSchema),
});

export const patchEmailParamsSchema = z.object({
  emailId: z.coerce.number().int().positive(),
});

export const patchEmailBodySchema = z.object({
  isRead: z.boolean().optional(),
  archived: z.boolean().optional(),
  trashed: z.boolean().optional(),
  spam: z.boolean().optional(),
  starred: z.boolean().optional(),
  snoozedUntil: z.number().nullable().optional(),
});

export const batchPatchEmailsBodySchema = z.object({
  emailIds: z.array(z.coerce.number().int().positive()).min(1),
  isRead: z.boolean().optional(),
  archived: z.boolean().optional(),
  trashed: z.boolean().optional(),
  spam: z.boolean().optional(),
  starred: z.boolean().optional(),
  snoozedUntil: z.number().nullable().optional(),
});

export const patchEmailResponseSchema = z.object({
  data: z.object({
    id: z.string(),
    isRead: z.boolean(),
    archived: z.boolean(),
    trashed: z.boolean(),
    spam: z.boolean(),
    starred: z.boolean(),
    snoozedUntil: z.number().nullable(),
  }),
});

export const sendEmailBodySchema = z.object({
  mailboxId: z.number().int().positive().optional(),
  to: z.string().email(),
  cc: z.string().optional(),
  bcc: z.string().optional(),
  subject: z.string().trim().min(1),
  body: z.string().trim().min(1),
  inReplyTo: z.string().trim().optional(),
  references: z.string().trim().optional(),
  threadId: z.string().trim().optional(),
  attachments: z
    .array(
      z.object({
        key: z.string(),
        filename: z.string(),
        mimeType: z.string(),
      }),
    )
    .optional(),
});

export const sendEmailResponseSchema = z.object({
  data: z.object({
    gmailId: z.string(),
    threadId: z.string(),
  }),
});
