import { zValidator } from "@hono/zod-validator";
import { and, desc, eq } from "drizzle-orm";
import type { Hono } from "hono";
import { notes } from "../../db/schema";
import type { AppRouteEnv } from "../types";
import { getNotesQuerySchema } from "./schemas";

export function registerGetNotes(api: Hono<AppRouteEnv>) {
  return api.get("/", zValidator("query", getNotesQuerySchema), async (c) => {
    const db = c.get("db");
    const user = c.get("user")!;

    const { limit = 100, offset = 0 } = c.req.valid("query");
    const conditions = [eq(notes.userId, user.id)];

    const rows = await db
      .select({
        id: notes.id,
        title: notes.title,
        createdAt: notes.createdAt,
        updatedAt: notes.updatedAt,
      })
      .from(notes)
      .where(and(...conditions))
      .orderBy(desc(notes.updatedAt), desc(notes.createdAt))
      .limit(limit)
      .offset(offset);

    return c.json({ data: rows, pagination: { limit, offset } }, 200);
  });
}
