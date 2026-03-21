import { z } from "zod";

export const syncRequestSchema = z.object({
  months: z.union([z.literal(6), z.literal(12)]).optional(),
  mailboxId: z.number().int().positive().optional(),
});

const errorResponseSchema = z.object({ error: z.string() });

const syncStatusResponseSchema = z.object({
  data: z.object({
    state: z.enum([
      "needs_mailbox_connect",
      "needs_reconnect",
      "ready_to_sync",
      "error",
      "syncing",
      "ready",
    ]),
    hasSynced: z.boolean(),
    historyId: z.string().nullable(),
    lastSync: z.number().nullable(),
    phase: z.string().nullable(),
    progressCurrent: z.number().nullable(),
    progressTotal: z.number().nullable(),
    error: z.string().nullable(),
    needsMailboxConnect: z.boolean(),
    needsGoogleReconnect: z.boolean(),
  }),
});

const syncAcceptedResponseSchema = z.object({
  data: z.object({ status: z.string() }),
});
