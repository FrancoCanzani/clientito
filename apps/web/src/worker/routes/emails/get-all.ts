import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { and, asc, desc, eq, like, or, sql } from "drizzle-orm";
import { emails } from "../../db/schema";
import { createTimer } from "../../lib/timing";
import type { AppRouteEnv } from "../types";
import {
  hasAnyEmailCategoryLabel,
  hasEmailLabel,
  toEmailListResponse,
  toEmailSearchResponse,
} from "./helpers";
import {
  emailPersonParamsSchema,
  emailPersonQuerySchema,
  emailPersonResponseSchema,
  emailThreadParamsSchema,
  emailThreadResponseSchema,
  errorResponseSchema,
  listEmailsQuerySchema,
  listEmailsResponseSchema,
  searchEmailsQuerySchema,
  searchEmailsResponseSchema,
} from "./schemas";

const listEmailsRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["emails"],
  request: { query: listEmailsQuerySchema },
  responses: {
    200: {
      content: { "application/json": { schema: listEmailsResponseSchema } },
      description: "Paginated email list",
    },
    401: {
      content: { "application/json": { schema: errorResponseSchema } },
      description: "Unauthorized",
    },
  },
});

const searchEmailsRoute = createRoute({
  method: "get",
  path: "/search",
  tags: ["emails"],
  request: { query: searchEmailsQuerySchema },
  responses: {
    200: {
      content: { "application/json": { schema: searchEmailsResponseSchema } },
      description: "Email search results",
    },
    401: {
      content: { "application/json": { schema: errorResponseSchema } },
      description: "Unauthorized",
    },
  },
});

const getEmailThreadRoute = createRoute({
  method: "get",
  path: "/thread/:threadId",
  tags: ["emails"],
  request: { params: emailThreadParamsSchema },
  responses: {
    200: {
      content: { "application/json": { schema: emailThreadResponseSchema } },
      description: "Thread emails",
    },
    401: {
      content: { "application/json": { schema: errorResponseSchema } },
      description: "Unauthorized",
    },
  },
});

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
      content: { "application/json": { schema: emailPersonResponseSchema } },
      description: "Person emails",
    },
    401: {
      content: { "application/json": { schema: errorResponseSchema } },
      description: "Unauthorized",
    },
  },
});

export function registerGetAllEmails(api: OpenAPIHono<AppRouteEnv>) {
  api.openapi(listEmailsRoute, async (c) => {
    const db = c.get("db");
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    const timer = createTimer("emails-list", { userId: user.id });

    const { limit = 50, offset = 0, search, isRead, category, view = "inbox" } =
      c.req.valid("query");
    timer.mark("query-validated");
    const conditions = [eq(emails.userId, user.id)];

    if (search) {
      const pattern = `%${search}%`;
      conditions.push(
        or(
          like(emails.subject, pattern),
          like(emails.snippet, pattern),
          like(emails.fromAddr, pattern),
        )!,
      );
    }

    if (isRead === "true") conditions.push(eq(emails.isRead, true));
    else if (isRead === "false") conditions.push(eq(emails.isRead, false));

    switch (view) {
      case "inbox":
        conditions.push(hasEmailLabel("INBOX"));
        conditions.push(sql<boolean>`not ${hasEmailLabel("SENT")}`);
        break;
      case "sent":
        conditions.push(hasEmailLabel("SENT"));
        break;
      case "spam":
        conditions.push(hasEmailLabel("SPAM"));
        break;
      case "trash":
        conditions.push(hasEmailLabel("TRASH"));
        break;
      case "all":
        break;
    }

    if (view === "inbox") {
      if (category === "primary") {
        conditions.push(
          sql<boolean>`(${hasEmailLabel("CATEGORY_PERSONAL")} or not ${hasAnyEmailCategoryLabel()})`,
        );
      } else if (category === "promotions") {
        conditions.push(hasEmailLabel("CATEGORY_PROMOTIONS"));
      } else if (category === "social") {
        conditions.push(hasEmailLabel("CATEGORY_SOCIAL"));
      } else if (category === "notifications") {
        conditions.push(
          sql<boolean>`(${hasEmailLabel("CATEGORY_UPDATES")} or ${hasEmailLabel("CATEGORY_FORUMS")})`,
        );
      }
    }

    const whereClause = and(...conditions);

    const rowsWithExtra = await db
      .select({
        id: emails.id,
        gmailId: emails.gmailId,
        fromAddr: emails.fromAddr,
        fromName: emails.fromName,
        toAddr: emails.toAddr,
        subject: emails.subject,
        snippet: emails.snippet,
        bodyText: sql<string | null>`null`,
        bodyHtml: sql<string | null>`null`,
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
      .limit(limit + 1)
      .offset(offset);
    const hasMore = rowsWithExtra.length > limit;
    const rows = hasMore ? rowsWithExtra.slice(0, limit) : rowsWithExtra;
    const total = offset + rows.length + (hasMore ? 1 : 0);
    timer.mark("rows");

    timer.end({ limit, offset, rowCount: rows.length, total, hasMore, view, category });
    return c.json(
      {
        data: rows.map(toEmailListResponse),
        pagination: {
          total,
          limit,
          offset,
          hasMore,
        },
      },
      200,
    );
  });

  api.openapi(searchEmailsRoute, async (c) => {
    const db = c.get("db");
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    const timer = createTimer("emails-search", { userId: user.id });

    const { q, limit = 30 } = c.req.valid("query");
    timer.mark("query-validated");
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
    timer.mark("rows");

    timer.end({ qLength: q.length, limit, rowCount: rows.length });
    return c.json({ data: rows.map(toEmailSearchResponse) }, 200);
  });

  api.openapi(getEmailThreadRoute, async (c) => {
    const db = c.get("db");
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    const timer = createTimer("emails-thread", { userId: user.id });

    const { threadId } = c.req.valid("param");
    timer.mark("param-validated");
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
      .where(and(eq(emails.threadId, threadId), eq(emails.userId, user.id)))
      .orderBy(asc(emails.date));
    timer.mark("rows");

    timer.end({ threadId, rowCount: rows.length });
    return c.json({ data: rows.map(toEmailListResponse) }, 200);
  });

  api.openapi(getPersonEmailsRoute, async (c) => {
    const db = c.get("db");
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    const timer = createTimer("emails-person", { userId: user.id });

    const { personId } = c.req.valid("param");
    const { limit = 50, offset = 0 } = c.req.valid("query");
    timer.mark("query-validated");

    const whereClause = and(
      eq(emails.personId, personId),
      eq(emails.userId, user.id),
    );

    const rowsWithExtra = await db
      .select({
        id: emails.id,
        gmailId: emails.gmailId,
        fromAddr: emails.fromAddr,
        fromName: emails.fromName,
        toAddr: emails.toAddr,
        subject: emails.subject,
        snippet: emails.snippet,
        bodyText: sql<string | null>`null`,
        bodyHtml: sql<string | null>`null`,
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
      .limit(limit + 1)
      .offset(offset);
    const hasMore = rowsWithExtra.length > limit;
    const rows = hasMore ? rowsWithExtra.slice(0, limit) : rowsWithExtra;
    const total = offset + rows.length + (hasMore ? 1 : 0);
    timer.mark("rows");

    timer.end({ personId, limit, offset, rowCount: rows.length, total, hasMore });
    return c.json(
      {
        data: rows.map(toEmailListResponse),
        pagination: { total, limit, offset, hasMore },
      },
      200,
    );
  });
}
