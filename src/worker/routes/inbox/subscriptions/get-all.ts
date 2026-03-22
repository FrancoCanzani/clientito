import { and, desc, eq, ne } from "drizzle-orm";
import type { Hono } from "hono";
import { emailSubscriptions } from "../../../db/schema";
import type { AppRouteEnv } from "../../types";

export function registerGetSubscriptions(api: Hono<AppRouteEnv>) {
  api.get("/", async (c) => {
    const db = c.get("db");
    const user = c.get("user")!;

    const rows = await db
      .select({
        fromAddr: emailSubscriptions.fromAddr,
        fromName: emailSubscriptions.fromName,
        emailCount: emailSubscriptions.emailCount,
        lastReceived: emailSubscriptions.lastReceivedAt,
        unsubscribeUrl: emailSubscriptions.unsubscribeUrl,
        unsubscribeEmail: emailSubscriptions.unsubscribeEmail,
        status: emailSubscriptions.status,
      })
      .from(emailSubscriptions)
      .where(
        and(
          eq(emailSubscriptions.userId, user.id),
          ne(emailSubscriptions.status, "unsubscribed"),
        ),
      )
      .orderBy(
        desc(emailSubscriptions.lastReceivedAt),
        desc(emailSubscriptions.emailCount),
      );

    return c.json({ data: rows }, 200);
  });
}
