import { zValidator } from "@hono/zod-validator";
import { and, eq } from "drizzle-orm";
import type { Hono } from "hono";
import { emails } from "../../../db/schema";
import {
  generateEmailOnDemand,
  getStoredEmailOnDemand,
} from "../../../lib/email/intelligence/detail";
import type { AppRouteEnv } from "../../types";
import { emailDetailParamsSchema } from "./schemas";

export function registerGetEmailAIDetail(api: Hono<AppRouteEnv>) {
  api.get(
    "/:emailId/ai",
    zValidator("param", emailDetailParamsSchema),
    async (c) => {
      const db = c.get("db");
      const user = c.get("user")!;
      const env = c.env;
      const { emailId } = c.req.valid("param");

      const emailRow = await db
        .select({ id: emails.id })
        .from(emails)
        .where(and(eq(emails.id, emailId), eq(emails.userId, user.id)))
        .limit(1);

      if (!emailRow[0]) return c.json({ error: "Email not found" }, 404);

      try {
        const result = await generateEmailOnDemand(db, env, emailId);
        return c.json({ data: result ?? null }, 200);
      } catch (error) {
        console.error("On-demand email analysis failed", { emailId, error });
        const fallback = await getStoredEmailOnDemand(db, emailId);
        return c.json({ data: fallback }, 200);
      }
    },
  );
}
