import { z } from "@hono/zod-openapi";

export const errorResponseSchema = z.object({ error: z.string() });

export const reminderSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  customerId: z.string(),
  userId: z.string(),
  message: z.string(),
  dueAt: z.number(),
  done: z.boolean(),
  createdAt: z.number(),
});

export const listRemindersQuerySchema = z.object({
  orgId: z.string().trim().min(1),
  done: z.enum(["true", "false", "all"]).optional(),
});

export const createReminderRequestSchema = z.object({
  orgId: z.string().trim().min(1),
  customerId: z.string().trim().min(1),
  message: z.string().trim().min(1),
  dueAt: z.number(),
});

export const updateReminderParamsSchema = z.object({
  id: z.string().trim().min(1),
});

export const updateReminderRequestSchema = z.object({
  message: z.string().trim().min(1).optional(),
  dueAt: z.number().optional(),
  done: z.boolean().optional(),
});
