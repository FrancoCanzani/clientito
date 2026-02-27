import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { and, desc, eq, like, or, sql } from "drizzle-orm";
import { customers, emails } from "../../db/schema";
import { ensureOrgAccess } from "../../lib/access";
import type { AppRouteEnv } from "../types";
import {
  errorResponseSchema,
  listEmailsQuerySchema,
  listEmailsResponseSchema,
} from "./schemas";
import { toEmailListResponse } from "./helpers";

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
    403: {
      content: { "application/json": { schema: errorResponseSchema } },
      description: "Forbidden",
    },
  },
});

export function registerGetEmailList(api: OpenAPIHono<AppRouteEnv>) {
  return api.openapi(listEmailsRoute, async (c) => {
    const db = c.get("db");
    const user = c.get("user");

    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const {
      orgId,
      limit = 50,
      offset = 0,
      search,
      customerId,
      isCustomer,
      category,
    } = c.req.valid("query");

    if (!(await ensureOrgAccess(db, orgId, user.id))) {
      return c.json({ error: "Forbidden" }, 403);
    }

    const conditions = [eq(emails.orgId, orgId)];

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

    if (customerId) {
      conditions.push(eq(emails.customerId, customerId));
    }

    if (isCustomer === "true") {
      conditions.push(eq(emails.isCustomer, true));
    } else if (isCustomer === "false") {
      conditions.push(eq(emails.isCustomer, false));
    }

    const hasLabel = (label: string) =>
      sql<boolean>`exists(
        select 1
        from json_each(coalesce(${emails.labelIds}, '[]'))
        where value = ${label}
      )`;
    const hasAnyCategoryLabel = sql<boolean>`exists(
      select 1
      from json_each(coalesce(${emails.labelIds}, '[]'))
      where value like 'CATEGORY_%'
    )`;

    if (category === "primary") {
      conditions.push(
        sql<boolean>`(${hasLabel("CATEGORY_PERSONAL")} or not ${hasAnyCategoryLabel})`,
      );
    } else if (category === "promotions") {
      conditions.push(hasLabel("CATEGORY_PROMOTIONS"));
    } else if (category === "social") {
      conditions.push(hasLabel("CATEGORY_SOCIAL"));
    } else if (category === "notifications") {
      conditions.push(
        sql<boolean>`(${hasLabel("CATEGORY_UPDATES")} or ${hasLabel("CATEGORY_FORUMS")})`,
      );
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
        threadId: emails.threadId,
        date: emails.date,
        isRead: emails.isRead,
        labelIds: emails.labelIds,
        isCustomer: emails.isCustomer,
        classified: emails.classified,
        createdAt: emails.createdAt,
        customerId: emails.customerId,
        customerName: customers.name,
      })
      .from(emails)
      .leftJoin(customers, eq(emails.customerId, customers.id))
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
