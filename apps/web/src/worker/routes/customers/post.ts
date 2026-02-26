import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";
import { customers } from "../../db/schema";
import { ensureOrgAccess } from "../../lib/access";
import { resolveCustomerName } from "../../lib/customer-name";
import type { AppRouteEnv } from "../types";
import { toCustomerResponse } from "./helpers";
import {
  createCustomerRequestSchema,
  customerSchema,
  errorResponseSchema,
} from "./schemas";

const createCustomerRoute = createRoute({
  method: "post",
  path: "/",
  tags: ["customers"],
  summary: "Create customer",
  request: {
    body: {
      content: {
        "application/json": {
          schema: createCustomerRequestSchema,
        },
      },
      required: true,
    },
  },
  responses: {
    201: {
      content: {
        "application/json": {
          schema: z.object({ data: customerSchema }),
        },
      },
      description: "Customer created",
    },
    401: {
      content: { "application/json": { schema: errorResponseSchema } },
      description: "Unauthorized",
    },
    403: {
      content: { "application/json": { schema: errorResponseSchema } },
      description: "Forbidden",
    },
    409: {
      content: { "application/json": { schema: errorResponseSchema } },
      description: "Conflict",
    },
    500: {
      content: { "application/json": { schema: errorResponseSchema } },
      description: "Internal server error",
    },
  },
});

export function registerPostCustomer(api: OpenAPIHono<AppRouteEnv>) {
  return api.openapi(createCustomerRoute, async (c) => {
    const db = c.get("db");
    const user = c.get("user");

    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const payload = c.req.valid("json");
    if (!(await ensureOrgAccess(db, payload.orgId, user.id))) {
      return c.json({ error: "Forbidden" }, 403);
    }

    const now = Date.now();
    let inserted: { id: string }[] | null = null;

    try {
      const normalizedEmail = payload.email.trim().toLowerCase();
      inserted = await db
        .insert(customers)
        .values({
          orgId: payload.orgId,
          name: resolveCustomerName(payload.name.trim(), normalizedEmail),
          company: payload.company?.trim() || null,
          email: normalizedEmail,
          phone: payload.phone?.trim() || null,
          website: payload.website?.trim() || null,
          vatEin: payload.vatEin?.trim() || null,
          address: payload.address?.trim() || null,
          notes: payload.notes ?? "",
          createdAt: now,
          updatedAt: now,
        })
        .returning({ id: customers.id });
    } catch (error) {
      if (error instanceof Error && error.message.toLowerCase().includes("unique")) {
        return c.json({ error: "Customer email already exists in this organization" }, 409);
      }
      throw error;
    }

    const created = inserted[0]
      ? await db.query.customers.findFirst({ where: eq(customers.id, inserted[0].id) })
      : null;

    if (!created) {
      return c.json({ error: "Failed to create customer" }, 500);
    }

    return c.json({ data: toCustomerResponse(created) }, 201);
  });
}
