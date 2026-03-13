import type { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  and,
  asc,
  desc,
  eq,
  gt,
  isNotNull,
  like,
  lt,
  or,
  sql,
} from "drizzle-orm";
import { companies, emails, notes, people, tasks } from "../../db/schema";
import type { AppRouteEnv } from "../types";
import { getPeopleQuerySchema, personIdParamsSchema } from "./schemas";

export function registerGetPeople(api: Hono<AppRouteEnv>) {
  return api.get("/", zValidator("query", getPeopleQuerySchema), async (c) => {
    const db = c.get("db");
    const user = c.get("user")!;

    const {
      q,
      lastContactedAfter,
      lastContactedBefore,
      sort,
      limit = 50,
      offset = 0,
    } = c.req.valid("query");
    const conditions = [eq(people.userId, user.id)];

    if (q) {
      const pattern = `%${q}%`;
      conditions.push(or(like(people.name, pattern), like(people.email, pattern))!);
    }

    if (lastContactedBefore !== undefined) {
      conditions.push(
        and(
          isNotNull(people.lastContactedAt),
          lt(people.lastContactedAt, lastContactedBefore),
        )!,
      );
    }

    if (lastContactedAfter !== undefined) {
      conditions.push(
        and(
          isNotNull(people.lastContactedAt),
          gt(people.lastContactedAt, lastContactedAfter),
        )!,
      );
    }

    const orderBy =
      sort === "lastContactedAsc"
        ? [asc(people.lastContactedAt), desc(people.id)]
        : [desc(people.lastContactedAt), desc(people.id)];

    const whereClause = and(...conditions);

    const [rows, totalRows] = await Promise.all([
      db
        .select({
          id: people.id,
          email: people.email,
          name: people.name,
          phone: people.phone,
          title: people.title,
          linkedin: people.linkedin,
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
        .where(whereClause)
        .orderBy(...orderBy)
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)` })
        .from(people)
        .where(whereClause),
    ]);

    return c.json(
      {
        data: rows,
        pagination: {
          total: Number(totalRows[0]?.count ?? 0),
          limit,
          offset,
        },
      },
      200,
    );
  });
}

export function registerGetPersonById(api: Hono<AppRouteEnv>) {
  return api.get("/:id", zValidator("param", personIdParamsSchema), async (c) => {
    const db = c.get("db");
    const user = c.get("user")!;

    const { id } = c.req.valid("param");

    const personRows = await db
      .select({
        id: people.id,
        email: people.email,
        name: people.name,
        phone: people.phone,
        title: people.title,
        linkedin: people.linkedin,
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
        title: notes.title,
        content: notes.content,
        personId: notes.personId,
        companyId: notes.companyId,
        createdAt: notes.createdAt,
        updatedAt: notes.updatedAt,
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
