import type { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { and, eq } from "drizzle-orm";
import { tasks } from "../../db/schema";
import type { AppRouteEnv } from "../types";
import { TASK_COLUMNS } from "./helpers";
import { postTaskBodySchema } from "./schemas";

export function registerPostTasks(api: Hono<AppRouteEnv>) {
  return api.post("/", zValidator("json", postTaskBodySchema), async (c) => {
    const db = c.get("db");
    const user = c.get("user")!;

    const { title, description, dueAt, dueTime, priority, status } =
      c.req.valid("json");

    const inserted = await db
      .insert(tasks)
      .values({
        userId: user.id,
        title,
        description: description ?? null,
        dueAt: dueAt ?? null,
        dueTime: dueTime ?? null,
        priority: priority ?? "low",
        status: status ?? "todo",
        createdAt: Date.now(),
      })
      .returning({ id: tasks.id });

    const createdId = inserted[0]!.id;

    const rows = await db
      .select(TASK_COLUMNS)
      .from(tasks)
      .where(and(eq(tasks.id, createdId), eq(tasks.userId, user.id)))
      .limit(1);

    return c.json({ data: rows[0]! }, 201);
  });
}
