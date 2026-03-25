import { zValidator } from "@hono/zod-validator";
import { and, eq } from "drizzle-orm";
import type { Hono } from "hono";
import { notes } from "../../db/schema";
import type { AppRouteEnv } from "../types";
import { noteIdParamsSchema, patchNoteBodySchema } from "./schemas";
import { cleanupRemovedNoteImages } from "./utils";

export function registerPatchNotes(api: Hono<AppRouteEnv>) {
  return api.patch(
    "/:id",
    zValidator("param", noteIdParamsSchema),
    zValidator("json", patchNoteBodySchema),
    async (c) => {
      const db = c.get("db");
      const user = c.get("user")!;
      const { id } = c.req.valid("param");
      const { title, content, isPinned } = c.req.valid("json");

      const existing = await db
        .select({ id: notes.id, content: notes.content })
        .from(notes)
        .where(and(eq(notes.id, id), eq(notes.userId, user.id)))
        .limit(1);
      if (!existing[0]) return c.json({ error: "Note not found" }, 404);
      const previousContent = existing[0].content;
      const nextContent = content ?? previousContent;

      await db
        .update(notes)
        .set({
          ...(title !== undefined ? { title: title.trim() } : {}),
          ...(content !== undefined ? { content } : {}),
          ...(isPinned !== undefined ? { isPinned } : {}),
          updatedAt: Date.now(),
        })
        .where(and(eq(notes.id, id), eq(notes.userId, user.id)));

      await cleanupRemovedNoteImages({
        db,
        env: c.env,
        userId: user.id,
        previousContent,
        nextContent,
        noteIdToExclude: id,
      });

      const rows = await db
        .select({
          id: notes.id,
          title: notes.title,
          content: notes.content,
          isPinned: notes.isPinned,
          createdAt: notes.createdAt,
          updatedAt: notes.updatedAt,
        })
        .from(notes)
        .where(and(eq(notes.id, id), eq(notes.userId, user.id)))
        .limit(1);

      return c.json({ data: rows[0]! }, 200);
    },
  );
}
