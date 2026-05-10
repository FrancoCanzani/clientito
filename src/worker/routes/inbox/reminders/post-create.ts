import { zValidator } from "@hono/zod-validator";
import { and, eq } from "drizzle-orm";
import type { Hono } from "hono";
import { z } from "zod";
import { replyReminders } from "../../../db/schema";
import { resolveMailbox } from "../../../lib/gmail/mailboxes";
import type { AppRouteEnv } from "../../types";
import { getUser } from "../../../middleware/auth";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const MAX_DURATION_MS = 90 * ONE_DAY_MS;

const createReminderSchema = z.object({
  mailboxId: z.number().int().positive(),
  threadId: z.string().min(1).max(200),
  sentMessageId: z.string().min(1).max(200),
  sentAt: z.number().int().positive(),
  durationMs: z.number().int().positive().max(MAX_DURATION_MS),
});

export function registerCreateReminder(api: Hono<AppRouteEnv>) {
  api.post("/", zValidator("json", createReminderSchema), async (c) => {
    const db = c.get("db");
    const user = getUser(c);
    const { mailboxId, threadId, sentMessageId, sentAt, durationMs } =
      c.req.valid("json");

    const mailbox = await resolveMailbox(db, user.id, mailboxId);
    if (!mailbox) return c.json({ error: "Mailbox not found" }, 404);

    const now = Date.now();
    const remindAt = sentAt + durationMs;

    const existing = await db.query.replyReminders.findFirst({
      where: and(
        eq(replyReminders.userId, user.id),
        eq(replyReminders.mailboxId, mailbox.id),
        eq(replyReminders.threadId, threadId),
      ),
    });

    if (existing) {
      await db
        .update(replyReminders)
        .set({
          sentMessageId,
          sentAt,
          remindAt,
          status: "pending",
          surfacedAt: null,
        })
        .where(eq(replyReminders.id, existing.id));

      return c.json(
        {
          data: {
            id: existing.id,
            threadId,
            remindAt,
            status: "pending" as const,
          },
        },
        200,
      );
    }

    const inserted = await db
      .insert(replyReminders)
      .values({
        userId: user.id,
        mailboxId: mailbox.id,
        threadId,
        sentMessageId,
        sentAt,
        remindAt,
        status: "pending",
        createdAt: now,
      })
      .returning();

    const row = inserted[0];
    if (!row) return c.json({ error: "Failed to create reminder" }, 500);

    return c.json(
      {
        data: {
          id: row.id,
          threadId: row.threadId,
          remindAt: row.remindAt,
          status: row.status,
        },
      },
      201,
    );
  });
}
