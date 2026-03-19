import { and, eq } from "drizzle-orm";
import type { Hono } from "hono";
import { emailFilters } from "../../db/schema";
import type { AppRouteEnv } from "../types";

export function registerDeleteFilter(app: Hono<AppRouteEnv>) {
  app.delete("/:id", async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const id = Number(c.req.param("id"));
    if (!Number.isFinite(id)) return c.json({ error: "Invalid id" }, 400);

    const db = c.get("db");
    const result = await db
      .delete(emailFilters)
      .where(and(eq(emailFilters.id, id), eq(emailFilters.userId, user.id)))
      .returning({ id: emailFilters.id });

    if (result.length === 0) return c.json({ error: "Not found" }, 404);
    return c.json({ ok: true });
  });
}
