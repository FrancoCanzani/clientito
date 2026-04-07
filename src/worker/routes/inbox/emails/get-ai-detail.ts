import { zValidator } from "@hono/zod-validator";
import type { Hono } from "hono";
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

      try {
        const result = await generateEmailOnDemand(db, env, emailId, user.id);
        if (!result) return c.json({ error: "Email not found" }, 404);
        return c.json(result, 200);
      } catch (error) {
        console.error("On-demand email analysis failed", { emailId, error });
        const fallback = await getStoredEmailOnDemand(db, emailId, user.id);
        return c.json(fallback ?? null, 200);
      }
    },
  );
}
