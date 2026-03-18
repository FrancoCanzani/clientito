import { z } from "zod";

export const errorResponseSchema = z.object({ error: z.string() });

export const noteIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const noteSchema = z.object({
  id: z.number(),
  title: z.string(),
  content: z.string(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const noteSummarySchema = noteSchema.pick({
  id: true,
  title: true,
  createdAt: true,
  updatedAt: true,
});

export const getNotesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export const listNotesResponseSchema = z.object({
  data: z.array(noteSummarySchema),
  pagination: z.object({
    limit: z.number(),
    offset: z.number(),
  }),
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

export const noteResponseSchema = z.object({
  data: noteSchema,
});

export const deleteNoteResponseSchema = z.object({
  data: z.object({
    deleted: z.boolean(),
  }),
});
