import { zValidator } from "@hono/zod-validator";
import { and, eq } from "drizzle-orm";
import type { Hono } from "hono";
import { z } from "zod";
import { proposedEvents } from "../../db/schema";
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

      const rows = await db
        .select({ id: proposedEvents.id })
        .from(proposedEvents)
        .where(
          and(
            eq(proposedEvents.id, id),
            eq(proposedEvents.userId, user.id),
            eq(proposedEvents.status, "pending"),
          ),
        )
        .limit(1);

      if (!rows[0]) return c.json({ error: "Proposed event not found" }, 404);

      await db
        .update(proposedEvents)
        .set({ status: "dismissed", updatedAt: Date.now() })
        .where(eq(proposedEvents.id, id));

      return c.json({ data: { dismissed: true } }, 200);
    },
  );
}
