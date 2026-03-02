import { z } from "@hono/zod-openapi";

export const errorResponseSchema = z.object({ error: z.string() });

export const emailSearchItemSchema = z.object({
  id: z.string(),
  gmailId: z.string(),
  fromAddr: z.string(),
  fromName: z.string().nullable(),
  toAddr: z.string().nullable(),
  subject: z.string().nullable(),
  snippet: z.string().nullable(),
  date: z.number(),
  isRead: z.boolean(),
  labelIds: z.array(z.string()),
  personId: z.string().nullable(),
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
  category: z
    .enum(["primary", "promotions", "social", "notifications"])
    .optional(),
  view: z.enum(["inbox", "sent", "spam", "trash", "all"]).optional(),
});

export const emailListItemSchema = emailSearchItemSchema.extend({
  bodyText: z.string().nullable(),
  bodyHtml: z.string().nullable(),
  threadId: z.string().nullable(),
  direction: z.enum(["sent", "received"]).nullable(),
  hasAttachment: z.boolean(),
  createdAt: z.number(),
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

export const emailDetailQuerySchema = z.object({
  emailId: z.string().trim().min(1),
  skipLive: z.coerce.boolean().optional(),
});

export const emailDetailResponseSchema = z.object({
  data: emailListItemSchema.extend({
    resolvedBodyText: z.string().nullable(),
    resolvedBodyHtml: z.string().nullable(),
    attachments: z.array(emailAttachmentSchema),
  }),
});

export const listEmailsResponseSchema = z.object({
  data: z.array(emailListItemSchema),
  pagination: z.object({
    total: z.number(),
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

export const emailPersonParamsSchema = z.object({
  personId: z.coerce.number().int().positive(),
});

export const emailPersonQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export const emailPersonResponseSchema = listEmailsResponseSchema;

export const sendEmailBodySchema = z.object({
  to: z.string().email(),
  subject: z.string().trim().min(1),
  body: z.string().trim().min(1),
  inReplyTo: z.string().trim().optional(),
  references: z.string().trim().optional(),
  threadId: z.string().trim().optional(),
});

export const sendEmailResponseSchema = z.object({
  data: z.object({
    status: z.string(),
    message: z.string(),
  }),
});
