import { zValidator } from "@hono/zod-validator";
import { and, eq } from "drizzle-orm";
import type { Hono } from "hono";
import { companies, notes, people } from "../../db/schema";
import type { AppRouteEnv } from "../types";
import { postNoteBodySchema } from "./schemas";

export function registerPostNotes(api: Hono<AppRouteEnv>) {
  return api.post("/", zValidator("json", postNoteBodySchema), async (c) => {
    const db = c.get("db");
    const user = c.get("user")!;

    const { content, personId, companyId } = c.req.valid("json");
    const now = Date.now();

    if (personId !== undefined) {
      const person = await db
        .select({ id: people.id })
        .from(people)
        .where(and(eq(people.id, personId), eq(people.userId, user.id)))
        .limit(1);
      if (!person[0]) return c.json({ error: "Person not found" }, 404);
    }

    if (companyId !== undefined) {
      const company = await db
        .select({ id: companies.id })
        .from(companies)
        .where(and(eq(companies.id, companyId), eq(companies.userId, user.id)))
        .limit(1);
      if (!company[0]) return c.json({ error: "Company not found" }, 404);
    }

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
