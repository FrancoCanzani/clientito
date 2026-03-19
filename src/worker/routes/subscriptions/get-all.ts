import { sql } from "drizzle-orm";
import type { Hono } from "hono";
import { emails } from "../../db/schema";
import type { AppRouteEnv } from "../types";

export function registerGetSubscriptions(api: Hono<AppRouteEnv>) {
  api.get("/", async (c) => {
    const db = c.get("db");
    const user = c.get("user")!;

    const rows = await db
      .select({
        fromAddr: emails.fromAddr,
        fromName: sql<string | null>`MAX(${emails.fromName})`.as("from_name"),
        emailCount: sql<number>`COUNT(*)`.as("email_count"),
        lastReceived: sql<number>`MAX(${emails.date})`.as("last_received"),
        unsubscribeUrl:
          sql<string | null>`MAX(${emails.unsubscribeUrl})`.as(
            "unsubscribe_url",
          ),
        unsubscribeEmail:
          sql<string | null>`MAX(${emails.unsubscribeEmail})`.as(
            "unsubscribe_email",
          ),
      })
      .from(emails)
      .where(
        sql`${emails.userId} = ${user.id} AND (${emails.unsubscribeUrl} IS NOT NULL OR ${emails.unsubscribeEmail} IS NOT NULL)`,
      )
      .groupBy(emails.fromAddr)
      .orderBy(sql`last_received DESC`);

    return c.json({ data: rows }, 200);
  });
}
