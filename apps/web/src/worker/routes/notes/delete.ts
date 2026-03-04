import type { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { and, eq } from "drizzle-orm";
import { notes } from "../../db/schema";
import type { AppRouteEnv } from "../types";
import { noteIdParamsSchema } from "./schemas";

export function registerDeleteNotes(api: Hono<AppRouteEnv>) {
  return api.delete("/:id", zValidator("param", noteIdParamsSchema), async (c) => {
    const db = c.get("db");
    const user = c.get("user")!;

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
