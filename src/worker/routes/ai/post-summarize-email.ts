import type { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { emails } from "../../db/schema";
import { generateEmailOnDemand } from "../../lib/email/intelligence/detail";
import type { AppRouteEnv } from "../types";

const summarizeEmailBodySchema = z.object({
  emailId: z.coerce.number().int().positive(),
});

export function registerPostSummarizeEmail(app: Hono<AppRouteEnv>) {
  app.post(
    "/summarize-email",
    zValidator("json", summarizeEmailBodySchema),
    async (c) => {
      const db = c.get("db");
      const user = c.get("user")!;
      const { emailId } = c.req.valid("json");

      const emailRow = await db
        .select({ id: emails.id })
        .from(emails)
        .where(and(eq(emails.id, emailId), eq(emails.userId, user.id)))
        .limit(1);

      if (!emailRow[0]) return c.json({ error: "Email not found" }, 404);

      const intelligence = await generateEmailOnDemand(db, c.env, emailId);

      if (!intelligence) {
        return c.json({ error: "AI summary unavailable" }, 503 as never);
      }

      return c.json({ data: { summary: intelligence.summary } }, 200);
    },
  );
}
