import { z } from "@hono/zod-openapi";

export const errorResponseSchema = z.object({ error: z.string() });

export const noteIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const noteSchema = z.object({
  id: z.number(),
  content: z.string(),
  personId: z.number().nullable(),
  companyId: z.number().nullable(),
  createdAt: z.number(),
});

export const postNoteBodySchema = z.object({
  content: z.string().trim().min(1),
  personId: z.number().int().positive().optional(),
  companyId: z.number().int().positive().optional(),
});

export const noteResponseSchema = z.object({
  data: noteSchema,
});

export const deleteNoteResponseSchema = z.object({
  data: z.object({
    deleted: z.boolean(),
  }),
});
