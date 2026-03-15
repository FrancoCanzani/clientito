import type { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { and, eq } from "drizzle-orm";
import { tasks } from "../../db/schema";
import type { AppRouteEnv } from "../types";
import { postTaskBodySchema } from "./schemas";

export function registerPostTasks(api: Hono<AppRouteEnv>) {
  return api.post("/", zValidator("json", postTaskBodySchema), async (c) => {
    const db = c.get("db");
    const user = c.get("user")!;

    const { title, description, dueAt, priority } = c.req.valid("json");
    const now = Date.now();

    const inserted = await db
      .insert(tasks)
      .values({
        userId: user.id,
        title,
        description: description ?? null,
        dueAt: dueAt ?? null,
        priority: priority ?? "low",
        done: false,
        createdAt: now,
      })
      .returning({ id: tasks.id });

    const createdId = inserted[0]!.id;

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
      .where(and(eq(tasks.id, createdId), eq(tasks.userId, user.id)))
      .limit(1);

    return c.json({ data: rows[0]! }, 201);
  });
}
