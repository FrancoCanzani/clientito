import { zValidator } from "@hono/zod-validator";
import { and, eq } from "drizzle-orm";
import type { Hono } from "hono";
import { z } from "zod";
import { replyReminders } from "../../../db/schema";
import { GmailDriver } from "../../../lib/gmail/driver";
import { ensureAwaitingReplyLabel } from "../../../lib/gmail/mailbox/awaiting-reply-label";
import type { AppRouteEnv } from "../../types";
import { getUser } from "../../../middleware/auth";

const dismissParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export function registerDismissReminder(api: Hono<AppRouteEnv>) {
  api.post(
    "/:id/dismiss",
    zValidator("param", dismissParamsSchema),
    async (c) => {
      const db = c.get("db");
      const user = getUser(c);
      const { id } = c.req.valid("param");

      const reminder = await db.query.replyReminders.findFirst({
        where: and(
          eq(replyReminders.id, id),
          eq(replyReminders.userId, user.id),
        ),
      });
      if (!reminder) return c.json({ error: "Reminder not found" }, 404);

      const wasSurfaced = reminder.status === "surfaced";

      await db
        .update(replyReminders)
        .set({ status: "dismissed" })
        .where(eq(replyReminders.id, reminder.id));

      if (wasSurfaced) {
        try {
          const labelId = await ensureAwaitingReplyLabel(
            db,
            c.env,
            reminder.mailboxId,
          );
          const provider = new GmailDriver(db, c.env, reminder.mailboxId);
          await provider.modifyThreadLabels(reminder.threadId, [], [labelId]);
        } catch (error) {
          console.warn("Failed to remove awaiting-reply label on dismiss", {
            reminderId: reminder.id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      return c.json({ data: { id: reminder.id, status: "dismissed" } }, 200);
    },
  );
}
