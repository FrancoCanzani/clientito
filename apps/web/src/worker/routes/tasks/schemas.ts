import { z } from "zod";

export const errorResponseSchema = z.object({ error: z.string() });

export const taskIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const taskSchema = z.object({
  id: z.number(),
  title: z.string(),
  dueAt: z.number().nullable(),
  done: z.boolean(),
  personId: z.number().nullable(),
  companyId: z.number().nullable(),
  createdAt: z.number(),
});

export const getTasksQuerySchema = z.object({
  dueToday: z.coerce.boolean().optional(),
  dueAfter: z.coerce.number().int().optional(),
  dueBefore: z.coerce.number().int().optional(),
  done: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export const listTasksResponseSchema = z.object({
  data: z.array(taskSchema),
  pagination: z.object({
    total: z.number(),
    limit: z.number(),
    offset: z.number(),
  }),
});

export const postTaskBodySchema = z.object({
  title: z.string().trim().min(1),
  dueAt: z.number().int().optional(),
  personId: z.number().int().positive().optional(),
  companyId: z.number().int().positive().optional(),
});

export const patchTaskBodySchema = z
  .object({
    title: z.string().trim().min(1).optional(),
    dueAt: z.number().int().nullable().optional(),
    done: z.boolean().optional(),
    personId: z.number().int().positive().nullable().optional(),
    companyId: z.number().int().positive().nullable().optional(),
  })
  .refine(
    (value) =>
      value.title !== undefined ||
      value.dueAt !== undefined ||
      value.done !== undefined ||
      value.personId !== undefined ||
      value.companyId !== undefined,
    { message: "At least one field must be provided" },
  );

export const taskResponseSchema = z.object({
  data: taskSchema,
});

export const deleteTaskResponseSchema = z.object({
  data: z.object({
    deleted: z.boolean(),
  }),
});
