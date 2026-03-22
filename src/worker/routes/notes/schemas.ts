import { z } from "zod";

export const noteIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const getNotesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export const postNoteBodySchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  content: z.string().optional().default(""),
});

export const patchNoteBodySchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    content: z.string().optional(),
  })
  .refine((value) => value.title !== undefined || value.content !== undefined, {
    message: "At least one field must be provided",
  });

export const noteImageQuerySchema = z.object({
  key: z.string().trim().min(1),
});
