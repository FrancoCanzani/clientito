import type { Hono } from "hono";
import { and, desc, eq } from "drizzle-orm";
import { scheduledEmails } from "../../../db/schema";
import type { AppRouteEnv } from "../../types";

export function registerGetScheduledEmails(api: Hono<AppRouteEnv>) {
  api.get("/scheduled", async (c) => {
    const db = c.get("db");
    const user = c.get("user")!;

    const rows = await db
      .select({
        id: scheduledEmails.id,
        to: scheduledEmails.to,
        subject: scheduledEmails.subject,
        scheduledFor: scheduledEmails.scheduledFor,
        status: scheduledEmails.status,
        error: scheduledEmails.error,
        createdAt: scheduledEmails.createdAt,
      })
      .from(scheduledEmails)
      .where(
        and(
          eq(scheduledEmails.userId, user.id),
          eq(scheduledEmails.status, "pending"),
        ),
      )
      .orderBy(desc(scheduledEmails.scheduledFor))
      .limit(50);

    return c.json({ data: rows });
  });

  api.delete("/scheduled/:id", async (c) => {
    const db = c.get("db");
    const user = c.get("user")!;
    const id = Number(c.req.param("id"));

    if (Number.isNaN(id)) {
      return c.json({ error: "Invalid ID" }, 400);
    }

    const rows = await db
      .update(scheduledEmails)
      .set({ status: "cancelled" })
      .where(
        and(
          eq(scheduledEmails.id, id),
          eq(scheduledEmails.userId, user.id),
          eq(scheduledEmails.status, "pending"),
        ),
      )
      .returning({ id: scheduledEmails.id });

    if (rows.length === 0) {
      return c.json({ error: "Scheduled email not found or already sent" }, 404);
    }

    return c.json({ data: { id: rows[0].id } });
  });
}
