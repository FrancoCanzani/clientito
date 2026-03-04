import { z } from "zod";

export const syncRequestSchema = z.object({
  months: z.coerce.number().int().min(1).optional(),
  continueFullSync: z.boolean().optional(),
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
    needsGoogleReconnect: z.boolean(),
    needsContactReview: z.boolean(),
  }),
});

export const syncAcceptedResponseSchema = z.object({
  data: z.object({ status: z.string() }),
});
