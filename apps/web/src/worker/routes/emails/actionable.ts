import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { and, eq, gt } from "drizzle-orm";
import { customers, emails } from "../../db/schema";
import { ensureOrgAccess } from "../../lib/access";
import type { AppRouteEnv } from "../types";
import { errorResponseSchema } from "./schemas";

const actionableQuerySchema = z.object({
  orgId: z.string().trim().min(1),
  since: z.coerce.number(),
});

const actionableResponseSchema = z.object({
  data: z.array(
    z.object({
      id: z.string(),
      fromAddr: z.string(),
      fromName: z.string().nullable(),
      subject: z.string().nullable(),
      customerId: z.string().nullable(),
      customerName: z.string().nullable(),
    }),
  ),
});

const actionableRoute = createRoute({
  method: "get",
  path: "/actionable",
  tags: ["emails"],
  request: { query: actionableQuerySchema },
  responses: {
    200: {
      content: { "application/json": { schema: actionableResponseSchema } },
      description: "Actionable emails",
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

export function registerGetActionableEmails(api: OpenAPIHono<AppRouteEnv>) {
  return api.openapi(actionableRoute, async (c) => {
    const db = c.get("db");
    const user = c.get("user");

    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const { orgId, since } = c.req.valid("query");
    if (!(await ensureOrgAccess(db, orgId, user.id))) {
      return c.json({ error: "Forbidden" }, 403);
    }

    const rows = await db
      .select({
        id: emails.id,
        fromAddr: emails.fromAddr,
        fromName: emails.fromName,
        subject: emails.subject,
        customerId: emails.customerId,
        customerName: customers.name,
      })
      .from(emails)
      .leftJoin(customers, eq(emails.customerId, customers.id))
      .where(
        and(
          eq(emails.orgId, orgId),
          eq(emails.isCustomer, true),
          gt(emails.date, since),
        ),
      )
      .limit(10);

    return c.json(
      {
        data: rows.map((r) => ({
          id: String(r.id),
          fromAddr: r.fromAddr,
          fromName: r.fromName,
          subject: r.subject,
          customerId: r.customerId ? String(r.customerId) : null,
          customerName: r.customerName ?? null,
        })),
      },
      200,
    );
  });
}
