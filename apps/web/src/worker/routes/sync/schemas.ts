import { z } from "@hono/zod-openapi";

export const syncRequestSchema = z.object({
  orgId: z.string().trim().min(1, "orgId is required"),
  months: z.coerce.number().int().min(1).optional(),
});

export const syncStatusQuerySchema = z.object({
  orgId: z.string().trim().min(1, "orgId is required"),
});

export const errorResponseSchema = z.object({ error: z.string() });

export const syncStatusResponseSchema = z.object({
  data: z.object({
    hasSynced: z.boolean(),
    historyId: z.string().nullable(),
    lastSync: z.number().nullable(),
    phase: z.string().nullable(),
    progressCurrent: z.number().nullable(),
    progressTotal: z.number().nullable(),
    error: z.string().nullable(),
    needsContactReview: z.boolean(),
  }),
});

export const syncAcceptedResponseSchema = z.object({
  data: z.object({ status: z.string() }),
});
