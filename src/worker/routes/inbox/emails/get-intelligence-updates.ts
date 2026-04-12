import { Hono } from "hono";
import { and, eq, gte } from "drizzle-orm";
import { createDb } from "../../../db/client";
import { emailIntelligence } from "../../../db/schema";
import type { AppRouteEnv } from "../../types";

export function registerGetIntelligenceUpdates(app: Hono<AppRouteEnv>) {
  app.get("/intelligence/updates", async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    const since = Number(c.req.query("since") || "0");
    const mailboxId = Number(c.req.query("mailboxId") || "0");

    if (!mailboxId) {
      return c.json({ error: "mailboxId required" }, 400);
    }

    const db = createDb(c.env.DB);

    const rows = await db
      .select({
        emailId: emailIntelligence.emailId,
        category: emailIntelligence.category,
        suspiciousJson: emailIntelligence.suspiciousJson,
        updatedAt: emailIntelligence.updatedAt,
      })
      .from(emailIntelligence)
      .where(
        and(
          eq(emailIntelligence.userId, user.id),
          eq(emailIntelligence.mailboxId, mailboxId),
          eq(emailIntelligence.status, "ready"),
          gte(emailIntelligence.updatedAt, since),
        ),
      )
      .limit(500);

    const data = rows.map((r) => ({
      emailId: r.emailId,
      category: r.category,
      isSuspicious: r.suspiciousJson?.isSuspicious ?? false,
      updatedAt: r.updatedAt,
    }));

    return c.json({ data }, 200);
  });
}
