import { z } from "zod";

export const draftIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const upsertDraftBodySchema = z.object({
  composeKey: z.string().min(1),
  mailboxId: z.number().int().positive().nullable().optional(),
  toAddr: z.string().default(""),
  ccAddr: z.string().default(""),
  bccAddr: z.string().default(""),
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

export const getDraftsQuerySchema = z.object({
  mailboxId: z.coerce.number().int().positive().optional(),
});
