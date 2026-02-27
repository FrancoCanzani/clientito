import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { and, desc, eq, like, or, sql } from "drizzle-orm";
import { contacts, customers } from "../../db/schema";
import { ensureOrgAccess } from "../../lib/access";
import type { AppRouteEnv } from "../types";
import {
  contactItemSchema,
  errorResponseSchema,
  listContactsQuerySchema,
} from "./schemas";

const listContactsRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["contacts"],
  request: {
    query: listContactsQuerySchema,
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({
            data: z.array(contactItemSchema),
            pagination: z.object({
              total: z.number(),
              limit: z.number(),
              offset: z.number(),
              hasMore: z.boolean(),
            }),
          }),
        },
      },
      description: "Contacts list",
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

export function registerGetContacts(api: OpenAPIHono<AppRouteEnv>) {
  return api.openapi(listContactsRoute, async (c) => {
    const db = c.get("db");
    const user = c.get("user");

    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const { orgId, search, domain, limit = 100, offset = 0 } = c.req.valid("query");
    if (!(await ensureOrgAccess(db, orgId, user.id))) {
      return c.json({ error: "Forbidden" }, 403);
    }

    const searchPattern = search ? `%${search}%` : null;
    const userEmail = user.email?.trim().toLowerCase() ?? null;
    const baseConditions = [eq(contacts.orgId, orgId)];
    if (userEmail) {
      baseConditions.push(
        sql`trim(replace(replace(lower(${contacts.email}), '<', ''), '>', '')) != ${userEmail}`,
      );
    }
    if (domain) {
      baseConditions.push(eq(contacts.domain, domain));
    }
    const whereClause = searchPattern
      ? and(
          ...baseConditions,
          or(
            like(contacts.email, searchPattern),
            like(contacts.name, searchPattern),
            like(contacts.domain, searchPattern),
          ),
        )
      : and(...baseConditions);

    const totalRows = await db
      .select({ total: sql<number>`count(*)` })
      .from(contacts)
      .where(whereClause);
    const total = Number(totalRows[0]?.total ?? 0);

    const rows = await db
      .select({
        id: contacts.id,
        email: contacts.email,
        name: contacts.name,
        domain: contacts.domain,
        emailCount: contacts.emailCount,
        latestEmailDate: contacts.latestEmailDate,
        customerEmail: customers.email,
      })
      .from(contacts)
      .leftJoin(
        customers,
        and(
          eq(customers.orgId, contacts.orgId),
          eq(customers.email, contacts.email),
        ),
      )
      .where(whereClause)
      .orderBy(desc(contacts.emailCount))
      .limit(limit)
      .offset(offset);

    return c.json(
      {
        data: rows.map((row) => ({
          id: String(row.id),
          email: row.email,
          name: row.name,
          domain: row.domain,
          emailCount: row.emailCount,
          latestEmailDate: row.latestEmailDate,
          isAlreadyCustomer: row.customerEmail !== null,
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
