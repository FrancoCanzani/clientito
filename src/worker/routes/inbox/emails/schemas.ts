import { z } from "zod";

export const emailAttachmentQuerySchema = z.object({
  providerMessageId: z.string().trim().min(1),
  attachmentId: z.string().trim().min(1),
  mailboxId: z.coerce.number().int().positive(),
  filename: z.string().trim().optional(),
  mimeType: z.string().trim().optional(),
  inline: z.coerce.boolean().optional(),
});

export const patchEmailBodySchema = z.object({
  providerMessageId: z.string().trim().min(1),
  mailboxId: z.number().int().positive(),
  labelIds: z.array(z.string()).optional(),
  isRead: z.boolean().optional(),
  archived: z.boolean().optional(),
  trashed: z.boolean().optional(),
  spam: z.boolean().optional(),
  starred: z.boolean().optional(),
  snoozedUntil: z.number().nullable().optional(),
});

export const batchPatchEmailsBodySchema = z.object({
  items: z.array(z.object({
    providerMessageId: z.string().trim().min(1),
    mailboxId: z.number().int().positive(),
    labelIds: z.array(z.string()).optional(),
  })).min(1),
  isRead: z.boolean().optional(),
  archived: z.boolean().optional(),
  trashed: z.boolean().optional(),
  spam: z.boolean().optional(),
  starred: z.boolean().optional(),
  snoozedUntil: z.number().nullable().optional(),
});

export const patchThreadBodySchema = z.object({
  mailboxId: z.number().int().positive(),
  labelIds: z.array(z.string()).optional(),
  isRead: z.boolean().optional(),
  archived: z.boolean().optional(),
  trashed: z.boolean().optional(),
  spam: z.boolean().optional(),
  starred: z.boolean().optional(),
  snoozedUntil: z.number().nullable().optional(),
});

export const deleteEmailBodySchema = z.object({
  providerMessageId: z.string().trim().min(1),
  mailboxId: z.number().int().positive(),
});

export const sendEmailBodySchema = z.object({
  mailboxId: z.number().int().positive().optional(),
  to: z.string().min(1),
  cc: z.string().optional(),
  bcc: z.string().optional(),
  subject: z.string().trim().optional().default(""),
  body: z.string().optional().default(""),
  inReplyTo: z.string().trim().optional(),
  references: z.string().trim().optional(),
  threadId: z.string().trim().optional(),
  attachments: z
    .array(
      z.object({
        key: z.string(),
        filename: z.string(),
        mimeType: z.string(),
        disposition: z.enum(["attachment", "inline"]).optional(),
        contentId: z.string().optional(),
      }),
    )
    .optional(),
  scheduledFor: z.number().int().positive().optional(),
});
