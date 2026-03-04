import type { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { and, eq } from "drizzle-orm";
import { companies, people, tasks } from "../../db/schema";
import type { AppRouteEnv } from "../types";
import { patchTaskBodySchema, taskIdParamsSchema } from "./schemas";

export function registerPatchTasks(api: Hono<AppRouteEnv>) {
  return api.patch(
    "/:id",
    zValidator("param", taskIdParamsSchema),
    zValidator("json", patchTaskBodySchema),
    async (c) => {
      const db = c.get("db");
      const user = c.get("user")!;

      const { id } = c.req.valid("param");
      const { title, dueAt, done, personId, companyId } = c.req.valid("json");

      const existing = await db
        .select({ id: tasks.id })
        .from(tasks)
        .where(and(eq(tasks.id, id), eq(tasks.userId, user.id)))
        .limit(1);
      if (!existing[0]) return c.json({ error: "Task not found" }, 404);

      if (personId !== undefined && personId !== null) {
        const person = await db
          .select({ id: people.id })
          .from(people)
          .where(and(eq(people.id, personId), eq(people.userId, user.id)))
          .limit(1);
        if (!person[0]) return c.json({ error: "Person not found" }, 404);
      }

      if (companyId !== undefined && companyId !== null) {
        const company = await db
          .select({ id: companies.id })
          .from(companies)
          .where(and(eq(companies.id, companyId), eq(companies.userId, user.id)))
          .limit(1);
        if (!company[0]) return c.json({ error: "Company not found" }, 404);
      }

      await db
        .update(tasks)
        .set({
          title,
          dueAt,
          done,
          personId,
          companyId,
        })
        .where(and(eq(tasks.id, id), eq(tasks.userId, user.id)));

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
        .where(and(eq(tasks.id, id), eq(tasks.userId, user.id)))
        .limit(1);

      return c.json({ data: rows[0]! }, 200);
    },
  );
}
