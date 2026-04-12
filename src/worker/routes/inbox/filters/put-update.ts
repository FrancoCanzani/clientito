import type { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { emailFilters } from "../../../db/schema";
import type { AppRouteEnv } from "../../types";

const actionsSchema = z.object({
  archive: z.boolean().optional(),
  markRead: z.boolean().optional(),
  star: z.boolean().optional(),
  applyCategory: z
    .enum([
      "to_respond",
      "to_follow_up",
      "fyi",
      "notification",
      "invoice",
      "marketing",
    ])
    .optional(),
  trash: z.boolean().optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().min(1).max(500).optional(),
  actions: actionsSchema.optional(),
  enabled: z.boolean().optional(),
  priority: z.number().int().optional(),
});

export function registerUpdateFilter(app: Hono<AppRouteEnv>) {
  app.put("/:id", zValidator("json", updateSchema), async (c) => {
    const user = c.get("user")!;

    const id = Number(c.req.param("id"));
    if (!Number.isFinite(id)) return c.json({ error: "Invalid id" }, 400);

    const body = c.req.valid("json");
    const db = c.get("db");

    const [row] = await db
      .update(emailFilters)
      .set(body)
      .where(and(eq(emailFilters.id, id), eq(emailFilters.userId, user.id)))
      .returning();

    if (!row) return c.json({ error: "Not found" }, 404);
    return c.json(row);
  });
}
