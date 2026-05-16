import { z } from "zod";

export const threadSummarySchema = z.object({
  summary: z.string().trim().min(1),
});

export type ThreadSummary = z.infer<typeof threadSummarySchema>;
