import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { desc, eq } from "drizzle-orm";
import { customers, customerSummaries } from "../../db/schema";
import { ensureOrgAccess } from "../../lib/access";
import type { AppRouteEnv } from "../types";
import { customerIdParamsSchema, errorResponseSchema } from "./schemas";
import { customerHealthSchema } from "./summary-service";

const getCustomerSummaryRoute = createRoute({
  method: "get",
  path: "/:id/summary",
  tags: ["customers"],
  request: {
    params: customerIdParamsSchema,
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({
            data: customerHealthSchema
              .extend({ generatedAt: z.number(), triggerReason: z.string().nullable() })
              .nullable(),
          }),
        },
      },
      description: "Customer health summary",
    },
    401: {
      content: { "application/json": { schema: errorResponseSchema } },
      description: "Unauthorized",
    },
    403: {
      content: { "application/json": { schema: errorResponseSchema } },
      description: "Forbidden",
    },
    404: {
      content: { "application/json": { schema: errorResponseSchema } },
      description: "Not found",
    },
  },
});

export function registerGetCustomerSummary(api: OpenAPIHono<AppRouteEnv>) {
  return api.openapi(getCustomerSummaryRoute, async (c) => {
    const db = c.get("db");
    const user = c.get("user");

    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const { id } = c.req.valid("param");

    const [customer] = await db
      .select({ orgId: customers.orgId })
      .from(customers)
      .where(eq(customers.id, id))
      .limit(1);

    if (!customer) return c.json({ error: "Customer not found" }, 404);

    if (!(await ensureOrgAccess(db, customer.orgId, user.id))) {
      return c.json({ error: "Forbidden" }, 403);
    }

    const [row] = await db
      .select()
      .from(customerSummaries)
      .where(eq(customerSummaries.customerId, id))
      .orderBy(desc(customerSummaries.generatedAt))
      .limit(1);

    if (!row) {
      return c.json({ data: null }, 200);
    }

    const parsed = JSON.parse(row.summary);
    return c.json(
      {
        data: {
          ...parsed,
          generatedAt: row.generatedAt,
          triggerReason: row.triggerReason,
        },
      },
      200,
    );
  });
}
