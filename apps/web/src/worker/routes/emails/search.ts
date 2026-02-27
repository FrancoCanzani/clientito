import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { and, desc, eq, like, or } from "drizzle-orm";
import { customers, emails } from "../../db/schema";
import { ensureOrgAccess } from "../../lib/access";
import type { AppRouteEnv } from "../types";
import {
  errorResponseSchema,
  searchEmailsQuerySchema,
  searchEmailsResponseSchema,
} from "./schemas";
import { toEmailSearchResponse } from "./helpers";

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
    403: {
      content: { "application/json": { schema: errorResponseSchema } },
      description: "Forbidden",
    },
  },
});

export function registerGetEmailSearch(api: OpenAPIHono<AppRouteEnv>) {
  return api.openapi(searchEmailsRoute, async (c) => {
    const db = c.get("db");
    const user = c.get("user");

    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const { orgId, q, limit = 30 } = c.req.valid("query");
    if (!(await ensureOrgAccess(db, orgId, user.id))) {
      return c.json({ error: "Forbidden" }, 403);
    }

    const pattern = `%${q}%`;
    const rows = await db
      .select({
        id: emails.id,
        gmailId: emails.gmailId,
        fromAddr: emails.fromAddr,
        toAddr: emails.toAddr,
        subject: emails.subject,
        snippet: emails.snippet,
        date: emails.date,
        isCustomer: emails.isCustomer,
        customerId: emails.customerId,
        customerName: customers.name,
      })
      .from(emails)
      .leftJoin(customers, eq(emails.customerId, customers.id))
      .where(
        and(
          eq(emails.orgId, orgId),
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
