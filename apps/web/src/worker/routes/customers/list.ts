import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { and, asc, desc, eq, like, or, sql } from "drizzle-orm";
import { customers, emails, reminders } from "../../db/schema";
import { ensureOrgAccess } from "../../lib/access";
import type { AppRouteEnv } from "../types";
import {
  customerListItemSchema,
  errorResponseSchema,
  listCustomersQuerySchema,
} from "./schemas";
import { toCustomerResponse } from "./helpers";

const listCustomersRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["customers"],
  summary: "List customers for organization with aggregates",
  request: {
    query: listCustomersQuerySchema,
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({
            data: z.array(customerListItemSchema),
            pagination: z.object({
              total: z.number(),
              limit: z.number(),
              offset: z.number(),
              hasMore: z.boolean(),
            }),
          }),
        },
      },
      description: "Customers list",
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

export function registerGetCustomers(api: OpenAPIHono<AppRouteEnv>) {
  return api.openapi(listCustomersRoute, async (c) => {
    const db = c.get("db");
    const user = c.get("user");

    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const { orgId, limit = 50, offset = 0, search, sortBy = "name", order = "asc" } = c.req.valid("query");
    if (!(await ensureOrgAccess(db, orgId, user.id))) {
      return c.json({ error: "Forbidden" }, 403);
    }

    const searchPattern = search ? `%${search}%` : null;
    const whereClause = searchPattern
      ? and(
          eq(customers.orgId, orgId),
          or(
            like(customers.name, searchPattern),
            like(customers.company, searchPattern),
            like(customers.email, searchPattern),
          ),
        )
      : eq(customers.orgId, orgId);

    const totalRows = await db
      .select({
        total: sql<number>`count(*)`,
      })
      .from(customers)
      .where(whereClause);
    const total = Number(totalRows[0]?.total ?? 0);

    const rows = await db
      .select({
        id: customers.id,
        orgId: customers.orgId,
        name: customers.name,
        company: customers.company,
        email: customers.email,
        phone: customers.phone,
        website: customers.website,
        vatEin: customers.vatEin,
        address: customers.address,
        notes: customers.notes,
        createdAt: customers.createdAt,
        updatedAt: customers.updatedAt,
        emailCount: sql<number>`count(distinct ${emails.id})`,
        latestEmailDate: sql<number | null>`max(${emails.date})`,
        pendingRemindersCount: sql<number>`count(distinct case when ${reminders.done} = 0 then ${reminders.id} end)`,
        summaryStatus: sql<string | null>`(
          SELECT json_extract(summary, '$.status')
          FROM customer_summaries
          WHERE customer_id = ${customers.id}
          ORDER BY generated_at DESC LIMIT 1
        )`,
      })
      .from(customers)
      .leftJoin(emails, eq(emails.customerId, customers.id))
      .leftJoin(reminders, eq(reminders.customerId, customers.id))
      .where(whereClause)
      .groupBy(customers.id)
      .orderBy(() => {
        const dir = order === "desc" ? desc : asc;
        switch (sortBy) {
          case "activity":
            return dir(sql`max(${emails.date})`);
          case "emails":
            return dir(sql`count(distinct ${emails.id})`);
          default:
            return dir(customers.name);
        }
      })
      .limit(limit)
      .offset(offset);

    return c.json(
      {
        data: rows.map((row) => ({
          ...toCustomerResponse(row),
          emailCount: Number(row.emailCount) || 0,
          latestEmailDate: row.latestEmailDate ? Number(row.latestEmailDate) : null,
          pendingRemindersCount: Number(row.pendingRemindersCount) || 0,
          summaryStatus: row.summaryStatus ?? null,
        })),
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
