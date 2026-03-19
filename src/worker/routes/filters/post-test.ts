import { desc, eq } from "drizzle-orm";
import type { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { emails } from "../../db/schema";
import { applyFilters } from "../../lib/email-filter-engine";
import type { AppRouteEnv } from "../types";

const conditionSchema = z.object({
  field: z.enum(["from", "to", "subject", "aiLabel"]),
  operator: z.enum(["contains", "equals", "startsWith", "endsWith"]),
  value: z.string().min(1),
});

const actionsSchema = z.object({
  archive: z.boolean().optional(),
  markRead: z.boolean().optional(),
  star: z.boolean().optional(),
  applyAiLabel: z
    .enum(["important", "later", "newsletter", "transactional", "notification"])
    .optional(),
  trash: z.boolean().optional(),
});

const testSchema = z.object({
  conditions: z.array(conditionSchema).min(1),
  actions: actionsSchema,
});

export function registerTestFilter(app: Hono<AppRouteEnv>) {
  app.post("/test", zValidator("json", testSchema), async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const body = c.req.valid("json");
    const db = c.get("db");

    const recentEmails = await db
      .select({
        id: emails.id,
        fromAddr: emails.fromAddr,
        fromName: emails.fromName,
        toAddr: emails.toAddr,
        subject: emails.subject,
        aiLabel: emails.aiLabel,
        date: emails.date,
      })
      .from(emails)
      .where(eq(emails.userId, user.id))
      .orderBy(desc(emails.date))
      .limit(100);

    const filter = { conditions: body.conditions, actions: body.actions };
    const matches = recentEmails.filter(
      (email) => applyFilters(email, [filter]) !== null,
    );

    return c.json({
      data: {
        matchCount: matches.length,
        totalTested: recentEmails.length,
        samples: matches.slice(0, 10).map((e) => ({
          id: e.id,
          from: e.fromName || e.fromAddr,
          subject: e.subject,
          date: e.date,
        })),
      },
    });
  });
}
