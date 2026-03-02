import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { and, eq } from "drizzle-orm";
import { tasks } from "../../db/schema";
import type { AppRouteEnv } from "../types";
import {
  deleteTaskResponseSchema,
  errorResponseSchema,
  taskIdParamsSchema,
} from "./schemas";

const deleteTaskRoute = createRoute({
  method: "delete",
  path: "/:id",
  tags: ["tasks"],
  request: {
    params: taskIdParamsSchema,
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: deleteTaskResponseSchema,
        },
      },
      description: "Deleted",
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

export function registerDeleteTasks(api: OpenAPIHono<AppRouteEnv>) {
  return api.openapi(deleteTaskRoute, async (c) => {
    const db = c.get("db");
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

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
