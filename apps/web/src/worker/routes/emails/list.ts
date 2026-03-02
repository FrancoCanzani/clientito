import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { and, desc, eq, like, or, sql } from "drizzle-orm";
import { emails } from "../../db/schema";
import type { AppRouteEnv } from "../types";
import {
  errorResponseSchema,
  listEmailsQuerySchema,
  listEmailsResponseSchema,
} from "./schemas";
import {
  hasAnyEmailCategoryLabel,
  hasEmailLabel,
  toEmailListResponse,
} from "./utils";

const listEmailsRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["emails"],
  request: {
    query: listEmailsQuerySchema,
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: listEmailsResponseSchema,
        },
      },
      description: "Paginated email list",
    },
    401: {
      content: { "application/json": { schema: errorResponseSchema } },
      description: "Unauthorized",
    },
  },
});

export function registerGetEmailList(api: OpenAPIHono<AppRouteEnv>) {
  return api.openapi(listEmailsRoute, async (c) => {
    const db = c.get("db");
    const user = c.get("user");

    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const {
      limit = 50,
      offset = 0,
      search,
      isRead,
      category,
      view = "inbox",
    } = c.req.valid("query");

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

    if (isRead === "true") {
      conditions.push(eq(emails.isRead, true));
    } else if (isRead === "false") {
      conditions.push(eq(emails.isRead, false));
    }

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
