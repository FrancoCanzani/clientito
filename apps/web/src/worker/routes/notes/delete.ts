import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { and, eq } from "drizzle-orm";
import { notes } from "../../db/schema";
import type { AppRouteEnv } from "../types";
import {
  deleteNoteResponseSchema,
  errorResponseSchema,
  noteIdParamsSchema,
} from "./schemas";

const deleteNoteRoute = createRoute({
  method: "delete",
  path: "/:id",
  tags: ["notes"],
  request: {
    params: noteIdParamsSchema,
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: deleteNoteResponseSchema,
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

export function registerDeleteNotes(api: OpenAPIHono<AppRouteEnv>) {
  return api.openapi(deleteNoteRoute, async (c) => {
    const db = c.get("db");
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const { id } = c.req.valid("param");

    const existing = await db
      .select({ id: notes.id })
      .from(notes)
      .where(and(eq(notes.id, id), eq(notes.userId, user.id)))
      .limit(1);
    if (!existing[0]) return c.json({ error: "Note not found" }, 404);

    await db.delete(notes).where(and(eq(notes.id, id), eq(notes.userId, user.id)));

    return c.json({ data: { deleted: true } }, 200);
  });
}
