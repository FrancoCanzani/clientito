import type { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { and, eq } from "drizzle-orm";
import { tasks } from "../../db/schema";
import type { AppRouteEnv } from "../types";
import { patchTaskBodySchema, taskIdParamsSchema } from "./schemas";

export function registerPatchTasks(api: Hono<AppRouteEnv>) {
  return api.patch(
    "/:id",
    zValidator("param", taskIdParamsSchema),
    zValidator("json", patchTaskBodySchema),
    async (c) => {
      const db = c.get("db");
      const user = c.get("user")!;

      const { id } = c.req.valid("param");
      const { title, description, dueAt, priority, done } = c.req.valid("json");

      const existing = await db
        .select({ id: tasks.id })
        .from(tasks)
        .where(and(eq(tasks.id, id), eq(tasks.userId, user.id)))
        .limit(1);
      if (!existing[0]) return c.json({ error: "Task not found" }, 404);

      await db
        .update(tasks)
        .set({
          title,
          description,
          dueAt,
          priority,
          done,
        })
        .where(and(eq(tasks.id, id), eq(tasks.userId, user.id)));

      const rows = await db
        .select({
          id: tasks.id,
          title: tasks.title,
          description: tasks.description,
          dueAt: tasks.dueAt,
          priority: tasks.priority,
          done: tasks.done,
          createdAt: tasks.createdAt,
        })
        .from(tasks)
        .where(and(eq(tasks.id, id), eq(tasks.userId, user.id)))
        .limit(1);

      return c.json({ data: rows[0]! }, 200);
    },
  );
}
