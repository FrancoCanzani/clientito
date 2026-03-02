import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { and, desc, eq, gte, lte } from "drizzle-orm";
import { tasks } from "../../db/schema";
import type { AppRouteEnv } from "../types";
import {
  errorResponseSchema,
  getTasksQuerySchema,
  listTasksResponseSchema,
} from "./schemas";

const getTasksRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["tasks"],
  request: {
    query: getTasksQuerySchema,
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: listTasksResponseSchema,
        },
      },
      description: "Task list",
    },
    401: {
      content: { "application/json": { schema: errorResponseSchema } },
      description: "Unauthorized",
    },
  },
});

function getDayBoundsUtc(now: number) {
  const date = new Date(now).toISOString().slice(0, 10);
  const start = new Date(`${date}T00:00:00.000Z`).getTime();
  const end = start + 24 * 60 * 60 * 1000 - 1;
  return { start, end };
}

export function registerGetTasks(api: OpenAPIHono<AppRouteEnv>) {
  return api.openapi(getTasksRoute, async (c) => {
    const db = c.get("db");
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

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
