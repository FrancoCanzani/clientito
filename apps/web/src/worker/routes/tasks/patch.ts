import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { and, eq } from "drizzle-orm";
import { tasks } from "../../db/schema";
import type { AppRouteEnv } from "../types";
import {
  errorResponseSchema,
  patchTaskBodySchema,
  taskIdParamsSchema,
  taskResponseSchema,
} from "./schemas";

const patchTaskRoute = createRoute({
  method: "patch",
  path: "/:id",
  tags: ["tasks"],
  request: {
    params: taskIdParamsSchema,
    body: {
      content: {
        "application/json": {
          schema: patchTaskBodySchema,
        },
      },
      required: true,
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: taskResponseSchema,
        },
      },
      description: "Updated",
    },
    401: {
      content: { "application/json": { schema: errorResponseSchema } },
      description: "Unauthorized",
    },
    404: {
      content: { "application/json": { schema: errorResponseSchema } },
      description: "Not found",
    },
  },
});

export function registerPatchTasks(api: OpenAPIHono<AppRouteEnv>) {
  return api.openapi(patchTaskRoute, async (c) => {
    const db = c.get("db");
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const { id } = c.req.valid("param");
    const { title, dueAt, done, personId, companyId } = c.req.valid("json");

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
        dueAt,
        done,
        personId,
        companyId,
      })
      .where(and(eq(tasks.id, id), eq(tasks.userId, user.id)));

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
      .where(and(eq(tasks.id, id), eq(tasks.userId, user.id)))
      .limit(1);

    return c.json({ data: rows[0]! }, 200);
  });
}
