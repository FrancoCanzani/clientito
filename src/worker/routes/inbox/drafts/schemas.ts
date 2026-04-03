import { z } from "zod";

export const draftIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const upsertDraftBodySchema = z.object({
  composeKey: z.string().min(1),
  mailboxId: z.number().int().positive().nullable().optional(),
  to: z.string().default(""),
  cc: z.string().default(""),
  bcc: z.string().default(""),
  subject: z.string().default(""),
  body: z.string().default(""),
  forwardedContent: z.string().default(""),
  threadId: z.string().nullable().optional(),
  attachmentKeys: z
    .array(
      z.object({
        key: z.string(),
        filename: z.string(),
        mimeType: z.string(),
      }),
    )
    .nullable()
    .optional(),
});

export const deleteDraftByKeyQuerySchema = z.object({
  composeKey: z.string().min(1),
});
