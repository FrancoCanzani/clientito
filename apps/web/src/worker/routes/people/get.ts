import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { and, desc, eq, like, or } from "drizzle-orm";
import { companies, emails, notes, people, tasks } from "../../db/schema";
import type { AppRouteEnv } from "../types";
import {
  errorResponseSchema,
  getPeopleQuerySchema,
  getPersonResponseSchema,
  listPeopleResponseSchema,
  personIdParamsSchema,
} from "./schemas";

const getPeopleRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["people"],
  request: {
    query: getPeopleQuerySchema,
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: listPeopleResponseSchema,
        },
      },
      description: "People list",
    },
    401: {
      content: { "application/json": { schema: errorResponseSchema } },
      description: "Unauthorized",
    },
  },
});

const getPersonRoute = createRoute({
  method: "get",
  path: "/:id",
  tags: ["people"],
  request: {
    params: personIdParamsSchema,
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: getPersonResponseSchema,
        },
      },
      description: "Person detail",
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

export function registerGetPeople(api: OpenAPIHono<AppRouteEnv>) {
  return api.openapi(getPeopleRoute, async (c) => {
    const db = c.get("db");
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const { q, limit = 50, offset = 0 } = c.req.valid("query");
    const conditions = [eq(people.userId, user.id)];

    if (q) {
      const pattern = `%${q}%`;
      conditions.push(or(like(people.name, pattern), like(people.email, pattern))!);
    }

    const rows = await db
      .select({
        id: people.id,
        email: people.email,
        name: people.name,
        companyId: people.companyId,
        companyName: companies.name,
        companyDomain: companies.domain,
        lastContactedAt: people.lastContactedAt,
        createdAt: people.createdAt,
      })
      .from(people)
      .leftJoin(
        companies,
        and(eq(companies.id, people.companyId), eq(companies.userId, user.id)),
      )
      .where(and(...conditions))
      .orderBy(desc(people.lastContactedAt), desc(people.id))
      .limit(limit)
      .offset(offset);

    return c.json({ data: rows, pagination: { limit, offset } }, 200);
  });
}

export function registerGetPersonById(api: OpenAPIHono<AppRouteEnv>) {
  return api.openapi(getPersonRoute, async (c) => {
    const db = c.get("db");
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const { id } = c.req.valid("param");

    const personRows = await db
      .select({
        id: people.id,
        email: people.email,
        name: people.name,
        companyId: people.companyId,
        companyName: companies.name,
        companyDomain: companies.domain,
        lastContactedAt: people.lastContactedAt,
        createdAt: people.createdAt,
      })
      .from(people)
      .leftJoin(
        companies,
        and(eq(companies.id, people.companyId), eq(companies.userId, user.id)),
      )
      .where(and(eq(people.id, id), eq(people.userId, user.id)))
      .limit(1);

    const personRow = personRows[0];
    if (!personRow) return c.json({ error: "Person not found" }, 404);

    const recentEmails = await db
      .select({
        id: emails.id,
        threadId: emails.threadId,
        fromAddr: emails.fromAddr,
        toAddr: emails.toAddr,
        subject: emails.subject,
        snippet: emails.snippet,
        date: emails.date,
        direction: emails.direction,
        isRead: emails.isRead,
      })
      .from(emails)
      .where(and(eq(emails.personId, id), eq(emails.userId, user.id)))
      .orderBy(desc(emails.date))
      .limit(5);

    const openTasks = await db
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
      .where(
        and(
          eq(tasks.personId, id),
          eq(tasks.userId, user.id),
          eq(tasks.done, false),
        ),
      )
      .orderBy(desc(tasks.createdAt));

    const personNotes = await db
      .select({
        id: notes.id,
        content: notes.content,
        personId: notes.personId,
        companyId: notes.companyId,
        createdAt: notes.createdAt,
      })
      .from(notes)
      .where(and(eq(notes.personId, id), eq(notes.userId, user.id)))
      .orderBy(desc(notes.createdAt));

    return c.json(
      {
        data: {
          person: personRow,
          recentEmails,
          openTasks,
          notes: personNotes,
        },
      },
      200,
    );
  });
}
