import { z } from "zod";

export const previewCalendarInviteSchema = z.object({
  mailboxId: z.number().int().positive(),
  providerMessageId: z.string().trim().min(1),
});

export const respondCalendarInviteSchema = z.object({
  mailboxId: z.number().int().positive(),
  inviteUid: z.string().trim().min(1),
  response: z.enum(["accepted", "declined"]),
});
