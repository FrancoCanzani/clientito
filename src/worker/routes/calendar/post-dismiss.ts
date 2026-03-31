import { zValidator } from "@hono/zod-validator";
import type { Hono } from "hono";
import { z } from "zod";
import {
  findCalendarSuggestionById,
  updateCalendarSuggestion,
} from "../../lib/email/intelligence/store";
import type { AppRouteEnv } from "../types";

const paramsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export function registerPostDismissProposed(api: Hono<AppRouteEnv>) {
  api.post(
    "/proposed/:id/dismiss",
    zValidator("param", paramsSchema),
    async (c) => {
      const db = c.get("db");
      const user = c.get("user")!;
      const { id } = c.req.valid("param");

      const match = await findCalendarSuggestionById(db, user.id, id);
      if (!match || match.suggestion.status !== "pending") {
        return c.json({ error: "Proposed event not found" }, 404);
      }

      await updateCalendarSuggestion(db, match, { status: "dismissed" });

      return c.json({ data: { dismissed: true } }, 200);
    },
  );
}
