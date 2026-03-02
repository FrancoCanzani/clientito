import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { and, eq } from "drizzle-orm";
import { tasks } from "../../db/schema";
import type { AppRouteEnv } from "../types";
import {
  errorResponseSchema,
  postTaskBodySchema,
  taskResponseSchema,
} from "./schemas";

const postTaskRoute = createRoute({
  method: "post",
  path: "/",
  tags: ["tasks"],
  request: {
    body: {
      content: {
        "application/json": {
          schema: postTaskBodySchema,
        },
      },
      required: true,
    },
  },
  responses: {
    201: {
      content: {
        "application/json": {
          schema: taskResponseSchema,
        },
      },
      description: "Created",
    },
    401: {
      content: { "application/json": { schema: errorResponseSchema } },
      description: "Unauthorized",
    },
  },
});

export function registerPostTasks(api: OpenAPIHono<AppRouteEnv>) {
  return api.openapi(postTaskRoute, async (c) => {
    const db = c.get("db");
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const { title, dueAt, personId, companyId } = c.req.valid("json");
    const now = Date.now();

    const inserted = await db
      .insert(tasks)
      .values({
        userId: user.id,
        title,
        dueAt: dueAt ?? null,
        personId: personId ?? null,
        companyId: companyId ?? null,
        done: false,
        createdAt: now,
      })
      .returning({ id: tasks.id });

    const createdId = inserted[0]!.id;

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
      .where(and(eq(tasks.id, createdId), eq(tasks.userId, user.id)))
      .limit(1);

    return c.json({ data: rows[0]! }, 201);
  });
}
