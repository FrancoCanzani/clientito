import type { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { and, eq } from "drizzle-orm";
import { tasks } from "../../db/schema";
import type { AppRouteEnv } from "../types";
import { taskIdParamsSchema } from "./schemas";

export function registerDeleteTasks(api: Hono<AppRouteEnv>) {
  return api.delete("/:id", zValidator("param", taskIdParamsSchema), async (c) => {
    const db = c.get("db");
    const user = c.get("user")!;

    const { id } = c.req.valid("param");

    const existing = await db
      .select({ id: tasks.id })
      .from(tasks)
      .where(and(eq(tasks.id, id), eq(tasks.userId, user.id)))
      .limit(1);
    if (!existing[0]) return c.json({ error: "Task not found" }, 404);

    await db.delete(tasks).where(and(eq(tasks.id, id), eq(tasks.userId, user.id)));

    return c.json({ data: { deleted: true } }, 200);
  });
}
