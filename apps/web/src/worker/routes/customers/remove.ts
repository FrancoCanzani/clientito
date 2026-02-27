import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";
import { customers } from "../../db/schema";
import { ensureOrgAccess } from "../../lib/access";
import type { AppRouteEnv } from "../types";
import { customerIdParamsSchema, errorResponseSchema } from "./schemas";
import { getCustomerById } from "./service";

const deleteCustomerRoute = createRoute({
  method: "delete",
  path: "/:id",
  tags: ["customers"],
  summary: "Delete customer",
  request: {
    params: customerIdParamsSchema,
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({ data: z.object({ id: z.string() }) }),
        },
      },
      description: "Customer deleted",
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

export function registerDeleteCustomer(api: OpenAPIHono<AppRouteEnv>) {
  return api.openapi(deleteCustomerRoute, async (c) => {
    const db = c.get("db");
    const user = c.get("user");

    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const { id } = c.req.valid("param");
    const customer = await getCustomerById(db, id);
    if (!customer) {
      return c.json({ error: "Not found" }, 404);
    }

    if (!(await ensureOrgAccess(db, customer.orgId, user.id))) {
      return c.json({ error: "Forbidden" }, 403);
    }

    await db.delete(customers).where(eq(customers.id, id));
    return c.json({ data: { id } }, 200);
  });
}
