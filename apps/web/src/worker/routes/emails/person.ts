import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { and, desc, eq, sql } from "drizzle-orm";
import { emails } from "../../db/schema";
import type { AppRouteEnv } from "../types";
import {
  emailPersonParamsSchema,
  emailPersonQuerySchema,
  emailPersonResponseSchema,
  errorResponseSchema,
} from "./schemas";
import { toEmailListResponse } from "./utils";

const getPersonEmailsRoute = createRoute({
  method: "get",
  path: "/person/:personId",
  tags: ["emails"],
  request: {
    params: emailPersonParamsSchema,
    query: emailPersonQuerySchema,
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: emailPersonResponseSchema,
        },
      },
      description: "Person emails",
    },
    401: {
      content: { "application/json": { schema: errorResponseSchema } },
      description: "Unauthorized",
    },
  },
});

export function registerGetEmailsByPerson(api: OpenAPIHono<AppRouteEnv>) {
  return api.openapi(getPersonEmailsRoute, async (c) => {
    const db = c.get("db");
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const { personId } = c.req.valid("param");
    const { limit = 50, offset = 0 } = c.req.valid("query");

    const whereClause = and(
      eq(emails.personId, personId),
      eq(emails.userId, user.id),
    );

    const totalRows = await db
      .select({ total: sql<number>`count(*)` })
      .from(emails)
      .where(whereClause);
    const total = Number(totalRows[0]?.total ?? 0);

    const rows = await db
      .select({
        id: emails.id,
        gmailId: emails.gmailId,
        fromAddr: emails.fromAddr,
        fromName: emails.fromName,
        toAddr: emails.toAddr,
        subject: emails.subject,
        snippet: emails.snippet,
        bodyText: emails.bodyText,
        bodyHtml: emails.bodyHtml,
        threadId: emails.threadId,
        date: emails.date,
        direction: emails.direction,
        isRead: emails.isRead,
        labelIds: emails.labelIds,
        personId: emails.personId,
        createdAt: emails.createdAt,
      })
      .from(emails)
      .where(whereClause)
      .orderBy(desc(emails.date))
      .limit(limit)
      .offset(offset);

    return c.json(
      {
        data: rows.map(toEmailListResponse),
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + rows.length < total,
        },
      },
      200,
    );
  });
}
