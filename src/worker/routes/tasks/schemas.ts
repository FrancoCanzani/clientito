import { z } from "zod";

const taskPrioritySchema = z.enum(["urgent", "high", "medium", "low"]);
const taskStatusSchema = z.enum(["backlog", "todo", "in_progress", "done"]);

export const taskIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const getTasksQuerySchema = z.object({
  dueToday: z.coerce.boolean().optional(),
  dueAfter: z.coerce.number().int().optional(),
  dueBefore: z.coerce.number().int().optional(),
  sourceEmailId: z.coerce.number().int().positive().optional(),
  status: taskStatusSchema.optional(),
  view: z.enum(["today", "upcoming"]).optional(),
  limit: z.coerce.number().int().min(1).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export const postTaskBodySchema = z.object({
  title: z.string().trim().min(1),
  description: z.string().trim().max(4000).nullable().optional(),
  sourceEmailId: z.number().int().positive().optional(),
  dueAt: z.number().int().optional(),
  priority: taskPrioritySchema.optional(),
  status: taskStatusSchema.optional(),
});

export const patchTaskBodySchema = z
  .object({
    title: z.string().trim().min(1).optional(),
    description: z.string().trim().max(4000).nullable().optional(),
    dueAt: z.number().int().nullable().optional(),
    priority: taskPrioritySchema.optional(),
    status: taskStatusSchema.optional(),
    position: z.number().int().optional(),
  })
  .refine(
    (value) => Object.values(value).some((v) => v !== undefined),
    { message: "At least one field must be provided" },
  );
