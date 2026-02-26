import { z } from "@hono/zod-openapi";

export const classifyRequestSchema = z.object({
  orgId: z.string().trim().min(1, "orgId is required"),
  limit: z.number().int().min(1).max(100).optional(),
});

export const classifyResponseSchema = z.object({
  data: z.object({
    processed: z.number(),
    classified: z.number(),
    customerLinked: z.number(),
    failed: z.number(),
  }),
});

export const errorResponseSchema = z.object({
  error: z.string(),
});
