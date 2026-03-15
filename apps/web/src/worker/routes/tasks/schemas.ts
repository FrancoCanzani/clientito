import { z } from "zod";

const taskPrioritySchema = z.enum(["urgent", "high", "medium", "low"]);

export const errorResponseSchema = z.object({ error: z.string() });

export const taskIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const taskSchema = z.object({
  id: z.number(),
  title: z.string(),
  description: z.string().nullable(),
  dueAt: z.number().nullable(),
  priority: taskPrioritySchema,
  done: z.boolean(),
  createdAt: z.number(),
});

export const getTasksQuerySchema = z.object({
  dueToday: z.coerce.boolean().optional(),
  dueAfter: z.coerce.number().int().optional(),
  dueBefore: z.coerce.number().int().optional(),
  done: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().min(1).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export const listTasksResponseSchema = z.object({
  data: z.array(taskSchema),
  pagination: z.object({
    total: z.number(),
    limit: z.number().nullable(),
    offset: z.number(),
  }),
});

export const postTaskBodySchema = z.object({
  title: z.string().trim().min(1),
  description: z.string().trim().max(4000).nullable().optional(),
  dueAt: z.number().int().optional(),
  priority: taskPrioritySchema.optional(),
});

export const patchTaskBodySchema = z
  .object({
    title: z.string().trim().min(1).optional(),
    description: z.string().trim().max(4000).nullable().optional(),
    dueAt: z.number().int().nullable().optional(),
    priority: taskPrioritySchema.optional(),
    done: z.boolean().optional(),
  })
  .refine(
    (value) =>
      value.title !== undefined ||
      value.description !== undefined ||
      value.dueAt !== undefined ||
      value.priority !== undefined ||
      value.done !== undefined,
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
