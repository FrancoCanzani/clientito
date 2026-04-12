import { z } from "zod";

export const listEmailsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  search: z.string().trim().max(500).optional(),
  isRead: z.enum(["true", "false"]).optional(),
  view: z.enum(["inbox", "sent", "spam", "trash", "snoozed", "archived", "starred", "important", "to_respond", "to_follow_up", "fyi", "notification", "invoice", "marketing", "all"]).optional(),
  mailboxId: z.coerce.number().int().positive().optional(),
  includeBody: z.coerce.boolean().optional(),
  includeAi: z.coerce.boolean().optional(),
});

export const emailDetailParamsSchema = z.object({
  emailId: z.coerce.number().int().positive(),
});

export const emailDetailQuerySchema = z.object({
  refreshLive: z.coerce.boolean().optional(),
});

export const emailAttachmentQuerySchema = z.object({
  providerMessageId: z.string().trim().min(1),
  attachmentId: z.string().trim().min(1),
  filename: z.string().trim().optional(),
  mimeType: z.string().trim().optional(),
  inline: z.coerce.boolean().optional(),
});

export const emailThreadParamsSchema = z.object({
  threadId: z.string().trim().min(1),
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

export const sendEmailBodySchema = z.object({
  mailboxId: z.number().int().positive().optional(),
  to: z.string().min(1),
  cc: z.string().optional(),
  bcc: z.string().optional(),
  subject: z.string().trim().optional().default(""),
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
  scheduledFor: z.number().int().positive().optional(),
});
