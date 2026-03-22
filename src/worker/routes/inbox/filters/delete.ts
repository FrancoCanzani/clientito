import { and, eq } from "drizzle-orm";
import type { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { emailFilters } from "../../../db/schema";
import type { AppRouteEnv } from "../../types";

const deleteFilterParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export function registerDeleteFilter(app: Hono<AppRouteEnv>) {
  app.delete("/:id", zValidator("param", deleteFilterParamsSchema), async (c) => {
    const user = c.get("user")!;

    const { id } = c.req.valid("param");

    const db = c.get("db");
    const result = await db
      .delete(emailFilters)
      .where(and(eq(emailFilters.id, id), eq(emailFilters.userId, user.id)))
      .returning({ id: emailFilters.id });

    if (result.length === 0) return c.json({ error: "Not found" }, 404);
    return c.json({ ok: true });
  });
}
