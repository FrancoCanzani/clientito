import { desc, eq } from "drizzle-orm";
import type { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { emails } from "../../../db/schema";
import { classifyEmails } from "../../../lib/email/ai-classifier";
import type { AppRouteEnv } from "../../types";

const testSchema = z.object({
  description: z.string().min(1).max(500),
});

export function registerTestFilter(app: Hono<AppRouteEnv>) {
  app.post("/test", zValidator("json", testSchema), async (c) => {
    const user = c.get("user")!;

    const { description } = c.req.valid("json");
    const db = c.get("db");

    const recentEmails = await db
      .select({
        id: emails.id,
        fromAddr: emails.fromAddr,
        fromName: emails.fromName,
        subject: emails.subject,
        snippet: emails.snippet,
        bodyText: emails.bodyText,
        unsubscribeUrl: emails.unsubscribeUrl,
        unsubscribeEmail: emails.unsubscribeEmail,
        date: emails.date,
      })
      .from(emails)
      .where(eq(emails.userId, user.id))
      .orderBy(desc(emails.date))
      .limit(100);

    const FAKE_FILTER_ID = -1;
    const batch = recentEmails.map((e, i) => ({
      index: i,
      from: e.fromAddr,
      fromName: e.fromName,
      subject: e.subject,
      snippet: e.snippet,
      bodyText: e.bodyText,
      hasUnsubscribe: Boolean(e.unsubscribeUrl || e.unsubscribeEmail),
    }));

    const { filterMatches } = await classifyEmails(
      c.env.AI,
      batch,
      [{ id: FAKE_FILTER_ID, description }],
    );

    const matchedIndices = new Set<number>();
    for (const [idx, ids] of filterMatches) {
      if (ids.includes(FAKE_FILTER_ID)) matchedIndices.add(idx);
    }

    const matches = recentEmails.filter((_, i) => matchedIndices.has(i));

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
