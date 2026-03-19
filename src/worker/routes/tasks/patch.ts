import type { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { and, eq } from "drizzle-orm";
import { tasks } from "../../db/schema";
import type { AppRouteEnv } from "../types";
import { TASK_COLUMNS } from "./helpers";
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
      const body = c.req.valid("json");

      const existing = await db
        .select({ id: tasks.id, status: tasks.status })
        .from(tasks)
        .where(and(eq(tasks.id, id), eq(tasks.userId, user.id)))
        .limit(1);
      if (!existing[0]) return c.json({ error: "Task not found" }, 404);

      const fields = { ...body };

      // Track completion timestamp
      if (fields.status === "done" && existing[0].status !== "done") {
        (fields as Record<string, unknown>).completedAt = Date.now();
      } else if (fields.status && fields.status !== "done") {
        (fields as Record<string, unknown>).completedAt = null;
      }

      await db
        .update(tasks)
        .set(fields)
        .where(and(eq(tasks.id, id), eq(tasks.userId, user.id)));

      const rows = await db
        .select(TASK_COLUMNS)
        .from(tasks)
        .where(and(eq(tasks.id, id), eq(tasks.userId, user.id)))
        .limit(1);

      return c.json({ data: rows[0]! }, 200);
    },
  );
}
