import { zValidator } from "@hono/zod-validator";
import { and, eq } from "drizzle-orm";
import type { Hono } from "hono";
import { notes } from "../../db/schema";
import type { AppRouteEnv } from "../types";
import { postNoteBodySchema } from "./schemas";

function deriveTitle(inputTitle: string | undefined): string {
  const fromInput = inputTitle?.trim();
  if (fromInput && fromInput.length > 0) return fromInput;
  return "Untitled note";
}

export function registerPostNotes(api: Hono<AppRouteEnv>) {
  return api.post("/", zValidator("json", postNoteBodySchema), async (c) => {
    const db = c.get("db");
    const user = c.get("user")!;

    const { title, content } = c.req.valid("json");
    const now = Date.now();

    const inserted = await db
      .insert(notes)
      .values({
        userId: user.id,
        title: deriveTitle(title),
        content,
        createdAt: now,
        updatedAt: now,
      })
      .returning({ id: notes.id });

    const createdId = inserted[0]!.id;

    const rows = await db
        .select({
          id: notes.id,
          title: notes.title,
          content: notes.content,
          createdAt: notes.createdAt,
          updatedAt: notes.updatedAt,
        })
      .from(notes)
      .where(and(eq(notes.id, createdId), eq(notes.userId, user.id)))
      .limit(1);

    return c.json({ data: rows[0]! }, 201);
  });
}
