import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { and, asc, desc, eq, like, or, sql } from "drizzle-orm";
import { companies, notes, people, tasks } from "../../db/schema";
import type { AppRouteEnv } from "../types";
import {
  companyIdParamsSchema,
  errorResponseSchema,
  getCompaniesQuerySchema,
  getCompanyResponseSchema,
  listCompaniesResponseSchema,
} from "./schemas";

const getCompaniesRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["companies"],
  request: {
    query: getCompaniesQuerySchema,
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: listCompaniesResponseSchema,
        },
      },
      description: "Company list",
    },
    401: {
      content: { "application/json": { schema: errorResponseSchema } },
      description: "Unauthorized",
    },
  },
});

const getCompanyRoute = createRoute({
  method: "get",
  path: "/:id",
  tags: ["companies"],
  request: {
    params: companyIdParamsSchema,
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: getCompanyResponseSchema,
        },
      },
      description: "Company detail",
    },
    401: {
      content: { "application/json": { schema: errorResponseSchema } },
      description: "Unauthorized",
    },
    404: {
      content: { "application/json": { schema: errorResponseSchema } },
      description: "Not found",
    },
  },
});

export function registerGetCompanies(api: OpenAPIHono<AppRouteEnv>) {
  return api.openapi(getCompaniesRoute, async (c) => {
    const db = c.get("db");
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

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
        createdAt: companies.createdAt,
        peopleCount:
          sql<number>`(select count(*) from people where people.company_id = companies.id)`,
      })
      .from(companies)
      .where(and(...conditions))
      .orderBy(asc(companies.name), asc(companies.id));

    return c.json({ data: rows }, 200);
  });
}

export function registerGetCompanyById(api: OpenAPIHono<AppRouteEnv>) {
  return api.openapi(getCompanyRoute, async (c) => {
    const db = c.get("db");
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

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
        content: notes.content,
        personId: notes.personId,
        companyId: notes.companyId,
        createdAt: notes.createdAt,
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
