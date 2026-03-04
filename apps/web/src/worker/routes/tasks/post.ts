import type { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { and, eq } from "drizzle-orm";
import { companies, people, tasks } from "../../db/schema";
import type { AppRouteEnv } from "../types";
import { postTaskBodySchema } from "./schemas";

export function registerPostTasks(api: Hono<AppRouteEnv>) {
  return api.post("/", zValidator("json", postTaskBodySchema), async (c) => {
    const db = c.get("db");
    const user = c.get("user")!;

    const { title, dueAt, personId, companyId } = c.req.valid("json");
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
      .insert(tasks)
      .values({
        userId: user.id,
        title,
        dueAt: dueAt ?? null,
        personId: personId ?? null,
        companyId: companyId ?? null,
        done: false,
        createdAt: now,
      })
      .returning({ id: tasks.id });

    const createdId = inserted[0]!.id;

    const rows = await db
      .select({
        id: tasks.id,
        title: tasks.title,
        dueAt: tasks.dueAt,
        done: tasks.done,
        personId: tasks.personId,
        companyId: tasks.companyId,
        createdAt: tasks.createdAt,
      })
      .from(tasks)
      .where(and(eq(tasks.id, createdId), eq(tasks.userId, user.id)))
      .limit(1);

    return c.json({ data: rows[0]! }, 201);
  });
}
