import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { and, desc, eq, like, or, sql } from "drizzle-orm";
import { emails } from "../../db/schema";
import type { AppRouteEnv } from "../types";
import {
  errorResponseSchema,
  searchEmailsQuerySchema,
  searchEmailsResponseSchema,
} from "./schemas";
import { hasEmailLabel, toEmailSearchResponse } from "./utils";

const searchEmailsRoute = createRoute({
  method: "get",
  path: "/search",
  tags: ["emails"],
  request: {
    query: searchEmailsQuerySchema,
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: searchEmailsResponseSchema,
        },
      },
      description: "Email search results",
    },
    401: {
      content: { "application/json": { schema: errorResponseSchema } },
      description: "Unauthorized",
    },
  },
});

export function registerGetEmailSearch(api: OpenAPIHono<AppRouteEnv>) {
  return api.openapi(searchEmailsRoute, async (c) => {
    const db = c.get("db");
    const user = c.get("user");

    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const { q, limit = 30 } = c.req.valid("query");

    const pattern = `%${q}%`;
    const rows = await db
      .select({
        id: emails.id,
        gmailId: emails.gmailId,
        fromAddr: emails.fromAddr,
        fromName: emails.fromName,
        toAddr: emails.toAddr,
        subject: emails.subject,
        snippet: emails.snippet,
        date: emails.date,
        isRead: emails.isRead,
        labelIds: emails.labelIds,
        personId: emails.personId,
      })
      .from(emails)
      .where(
        and(
          eq(emails.userId, user.id),
          hasEmailLabel("INBOX"),
          sql<boolean>`not ${hasEmailLabel("SENT")}`,
          or(
            like(emails.fromAddr, pattern),
            like(emails.toAddr, pattern),
            like(emails.subject, pattern),
          ),
        ),
      )
      .orderBy(desc(emails.date))
      .limit(limit);

    return c.json({ data: rows.map(toEmailSearchResponse) }, 200);
  });
}
