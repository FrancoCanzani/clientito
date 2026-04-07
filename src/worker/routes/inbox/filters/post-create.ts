import type { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { emailFilters } from "../../../db/schema";
import type { AppRouteEnv } from "../../types";

const actionsSchema = z.object({
  archive: z.boolean().optional(),
  markRead: z.boolean().optional(),
  star: z.boolean().optional(),
  applyCategory: z
    .enum([
      "action_needed",
      "important",
      "newsletter",
      "transactional",
      "notification",
    ])
    .optional(),
  trash: z.boolean().optional(),
});

const createSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().trim().min(1).max(500),
  actions: actionsSchema,
  enabled: z.boolean().optional(),
  priority: z.number().int().optional(),
});

export function registerCreateFilter(app: Hono<AppRouteEnv>) {
  app.post("/", zValidator("json", createSchema), async (c) => {
    const user = c.get("user")!;

    const body = c.req.valid("json");
    const db = c.get("db");

    const [row] = await db
      .insert(emailFilters)
      .values({
        userId: user.id,
        name: body.name,
        description: body.description,
        conditions: [],
        actions: body.actions,
        enabled: body.enabled ?? true,
        priority: body.priority ?? 0,
        createdAt: Date.now(),
      })
      .returning();

    return c.json(row, 201);
  });
}
