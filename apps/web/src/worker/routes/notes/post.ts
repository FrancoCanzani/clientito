import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { and, eq } from "drizzle-orm";
import { notes } from "../../db/schema";
import type { AppRouteEnv } from "../types";
import {
  errorResponseSchema,
  noteResponseSchema,
  postNoteBodySchema,
} from "./schemas";

const postNoteRoute = createRoute({
  method: "post",
  path: "/",
  tags: ["notes"],
  request: {
    body: {
      content: {
        "application/json": {
          schema: postNoteBodySchema,
        },
      },
      required: true,
    },
  },
  responses: {
    201: {
      content: {
        "application/json": {
          schema: noteResponseSchema,
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

export function registerPostNotes(api: OpenAPIHono<AppRouteEnv>) {
  return api.openapi(postNoteRoute, async (c) => {
    const db = c.get("db");
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const { content, personId, companyId } = c.req.valid("json");
    const now = Date.now();

    const inserted = await db
      .insert(notes)
      .values({
        userId: user.id,
        content,
        personId: personId ?? null,
        companyId: companyId ?? null,
        createdAt: now,
      })
      .returning({ id: notes.id });

    const createdId = inserted[0]!.id;

    const rows = await db
      .select({
        id: notes.id,
        content: notes.content,
        personId: notes.personId,
        companyId: notes.companyId,
        createdAt: notes.createdAt,
      })
      .from(notes)
      .where(and(eq(notes.id, createdId), eq(notes.userId, user.id)))
      .limit(1);

    return c.json({ data: rows[0]! }, 201);
  });
}
