import type { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { and, eq } from "drizzle-orm";
import { notes } from "../../db/schema";
import type { AppRouteEnv } from "../types";
import { noteIdParamsSchema } from "./schemas";

export function registerGetNoteById(api: Hono<AppRouteEnv>) {
  return api.get("/:id", zValidator("param", noteIdParamsSchema), async (c) => {
    const db = c.get("db");
    const user = c.get("user")!;
    const { id } = c.req.valid("param");

    const rows = await db
      .select({
        id: notes.id,
        title: notes.title,
        content: notes.content,
        personId: notes.personId,
        companyId: notes.companyId,
        createdAt: notes.createdAt,
        updatedAt: notes.updatedAt,
      })
      .from(notes)
      .where(and(eq(notes.id, id), eq(notes.userId, user.id)))
      .limit(1);

    const row = rows[0];
    if (!row) return c.json({ error: "Note not found" }, 404);
    return c.json({ data: row }, 200);
  });
}
