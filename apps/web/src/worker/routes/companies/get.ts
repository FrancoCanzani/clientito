import type { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { and, asc, desc, eq, like, or, sql } from "drizzle-orm";
import { companies, notes, people, tasks } from "../../db/schema";
import type { AppRouteEnv } from "../types";
import { companyIdParamsSchema, getCompaniesQuerySchema } from "./schemas";

export function registerGetCompanies(api: Hono<AppRouteEnv>) {
  return api.get("/", zValidator("query", getCompaniesQuerySchema), async (c) => {
    const db = c.get("db");
    const user = c.get("user")!;

    const { q } = c.req.valid("query");
    const conditions = [eq(companies.userId, user.id)];

    if (q) {
      const pattern = `%${q}%`;
      conditions.push(or(like(companies.name, pattern), like(companies.domain, pattern))!);
    }

    const rows = await db
      .select({
        id: companies.id,
        domain: companies.domain,
        name: companies.name,
        industry: companies.industry,
        website: companies.website,
        description: companies.description,
        logoUrl: companies.logoUrl,
        createdAt: companies.createdAt,
        peopleCount:
          sql<number>`(select count(*) from people where people.company_id = companies.id and people.user_id = ${user.id})`,
      })
      .from(companies)
      .where(and(...conditions))
      .orderBy(asc(companies.name), asc(companies.id));

    return c.json({ data: rows }, 200);
  });
}

export function registerGetCompanyById(api: Hono<AppRouteEnv>) {
  return api.get("/:id", zValidator("param", companyIdParamsSchema), async (c) => {
    const db = c.get("db");
    const user = c.get("user")!;

    const { id } = c.req.valid("param");

    const companyRows = await db
      .select({
        id: companies.id,
        domain: companies.domain,
        name: companies.name,
        industry: companies.industry,
        website: companies.website,
        description: companies.description,
        createdAt: companies.createdAt,
      })
      .from(companies)
      .where(and(eq(companies.id, id), eq(companies.userId, user.id)))
      .limit(1);

    const company = companyRows[0];
    if (!company) return c.json({ error: "Company not found" }, 404);

    const linkedPeople = await db
      .select({
        id: people.id,
        email: people.email,
        name: people.name,
        phone: people.phone,
        title: people.title,
        linkedin: people.linkedin,
        companyId: people.companyId,
        lastContactedAt: people.lastContactedAt,
        createdAt: people.createdAt,
      })
      .from(people)
      .where(and(eq(people.companyId, id), eq(people.userId, user.id)))
      .orderBy(desc(people.lastContactedAt), desc(people.id));

    const companyTasks = await db
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
      .where(and(eq(tasks.companyId, id), eq(tasks.userId, user.id)))
      .orderBy(desc(tasks.createdAt));

    const companyNotes = await db
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
      .where(and(eq(notes.companyId, id), eq(notes.userId, user.id)))
      .orderBy(desc(notes.createdAt));

    return c.json(
      {
        data: {
          company,
          people: linkedPeople,
          tasks: companyTasks,
          notes: companyNotes,
        },
      },
      200,
    );
  });
}
