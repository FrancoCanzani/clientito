import type { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { and, desc, eq, gte, lte } from "drizzle-orm";
import { tasks } from "../../db/schema";
import type { AppRouteEnv } from "../types";
import { getTasksQuerySchema } from "./schemas";

function getDayBoundsUtc(now: number) {
  const date = new Date(now).toISOString().slice(0, 10);
  const start = new Date(`${date}T00:00:00.000Z`).getTime();
  const end = start + 24 * 60 * 60 * 1000 - 1;
  return { start, end };
}

export function registerGetTasks(api: Hono<AppRouteEnv>) {
  return api.get("/", zValidator("query", getTasksQuerySchema), async (c) => {
    const db = c.get("db");
    const user = c.get("user")!;

    const { dueToday, limit = 100, offset = 0 } = c.req.valid("query");
    const conditions = [eq(tasks.userId, user.id)];

    if (dueToday) {
      const { start, end } = getDayBoundsUtc(Date.now());
      conditions.push(gte(tasks.dueAt, start), lte(tasks.dueAt, end));
    }

    const rows = await db
      .select({
        id: tasks.id,
        title: tasks.title,
        dueAt: tasks.dueAt,
        done: tasks.done,
        personId: tasks.personId,
        companyId: tasks.companyId,
        createdAt: tasks.createdAt,
      })
      .from(tasks)
      .where(and(...conditions))
      .orderBy(desc(tasks.dueAt), desc(tasks.createdAt))
      .limit(limit)
      .offset(offset);

    return c.json({ data: rows, pagination: { limit, offset } }, 200);
  });
}
