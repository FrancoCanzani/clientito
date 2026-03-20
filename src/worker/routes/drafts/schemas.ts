import { z } from "zod";

export const draftBodySchema = z.object({
  to: z.string().optional(),
  cc: z.string().optional(),
  subject: z.string().optional(),
  body: z.string().optional(),
  inReplyTo: z.string().optional(),
  threadId: z.string().optional(),
});

export const draftParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});
