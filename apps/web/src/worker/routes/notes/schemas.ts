import { z } from "zod";

export const errorResponseSchema = z.object({ error: z.string() });

export const noteIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const noteSchema = z.object({
  id: z.number(),
  title: z.string(),
  content: z.string(),
  personId: z.number().nullable(),
  companyId: z.number().nullable(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const getNotesQuerySchema = z.object({
  scope: z.enum(["all", "canvas", "linked"]).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export const listNotesResponseSchema = z.object({
  data: z.array(noteSchema),
  pagination: z.object({
    limit: z.number(),
    offset: z.number(),
  }),
});

export const postNoteBodySchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  content: z.string().optional().default(""),
  personId: z.number().int().positive().optional(),
  companyId: z.number().int().positive().optional(),
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
