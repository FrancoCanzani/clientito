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
  isCustomer: z.boolean(),
  customerId: z.string().nullable(),
  customerName: z.string().nullable(),
});

export const searchEmailsQuerySchema = z.object({
  orgId: z.string().trim().min(1),
  q: z.string().trim().min(1),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const searchEmailsResponseSchema = z.object({
  data: z.array(emailSearchItemSchema),
});

export const listEmailsQuerySchema = z.object({
  orgId: z.string().trim().min(1),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  search: z.string().trim().optional(),
  customerId: z.string().trim().optional(),
  isCustomer: z.enum(["true", "false"]).optional(),
  isRead: z.enum(["true", "false"]).optional(),
  category: z
    .enum(["primary", "promotions", "social", "notifications"])
    .optional(),
});

export const emailListItemSchema = emailSearchItemSchema.extend({
  bodyText: z.string().nullable(),
  bodyHtml: z.string().nullable(),
  threadId: z.string().nullable(),
  hasAttachment: z.boolean(),
  classified: z.boolean(),
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
  orgId: z.string().trim().min(1),
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
  orgId: z.string().trim().min(1),
  gmailMessageId: z.string().trim().min(1),
  attachmentId: z.string().trim().min(1),
  filename: z.string().trim().optional(),
  mimeType: z.string().trim().optional(),
  inline: z.coerce.boolean().optional(),
});

export const analyzeEmailQuerySchema = z.object({
  orgId: z.string().trim().min(1),
  emailId: z.string().trim().min(1),
});

export const emailAnalysisResponseSchema = z.object({
  data: z.object({
    summary: z.string(),
    sentiment: z.enum(["positive", "neutral", "negative", "urgent"]),
    suggestedTasks: z.array(
      z.object({
        message: z.string(),
        dueInDays: z.number(),
      }),
    ).max(3),
    language: z.string(),
    translation: z.string().nullable(),
  }),
});

export const markAsCustomerRequestSchema = z.object({
  orgId: z.string().trim().min(1),
  emailAddress: z.string().trim().min(1),
  name: z.string().trim().optional(),
  company: z.string().trim().optional(),
});

export const markAsCustomerResponseSchema = z.object({
  data: z.object({
    customerId: z.string(),
    emailsLinked: z.number(),
  }),
});
