import { z } from "zod";

export const syncRequestSchema = z.object({
  months: z.union([z.literal(6), z.literal(12)]).optional(),
  mailboxId: z.number().int().positive().optional(),
});
