import { zValidator } from "@hono/zod-validator";
import { and, desc, eq, isNotNull, isNull, or } from "drizzle-orm";
import type { Hono } from "hono";
import { notes } from "../../db/schema";
import type { AppRouteEnv } from "../types";
import { getNotesQuerySchema } from "./schemas";

export function registerGetNotes(api: Hono<AppRouteEnv>) {
  return api.get("/", zValidator("query", getNotesQuerySchema), async (c) => {
    const db = c.get("db");
    const user = c.get("user")!;

    const { scope = "all", limit = 100, offset = 0 } = c.req.valid("query");
    const conditions = [eq(notes.userId, user.id)];
    if (scope === "canvas") {
      conditions.push(and(isNull(notes.personId), isNull(notes.companyId))!);
    }
    if (scope === "linked") {
      conditions.push(or(isNotNull(notes.personId), isNotNull(notes.companyId))!);
    }

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
      .where(and(...conditions))
      .orderBy(desc(notes.updatedAt), desc(notes.createdAt))
      .limit(limit)
      .offset(offset);

    return c.json({ data: rows, pagination: { limit, offset } }, 200);
  });
}
