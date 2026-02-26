import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";
import { customers, emails, reminders } from "../../db/schema";
import { ensureOrgAccess } from "../../lib/access";
import type { AppRouteEnv } from "../types";
import { toCustomerResponse } from "./helpers";
import {
  customerIdParamsSchema,
  customerSchema,
  errorResponseSchema,
  mergeCustomerRequestSchema,
} from "./schemas";
import { getCustomerById } from "./service";

const mergeCustomerRoute = createRoute({
  method: "post",
  path: "/:id/merge",
  tags: ["customers"],
  summary: "Merge source customer into target customer",
  request: {
    params: customerIdParamsSchema,
    body: {
      content: {
        "application/json": {
          schema: mergeCustomerRequestSchema,
        },
      },
      required: true,
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({
            data: z.object({
              targetCustomer: customerSchema,
              mergedCustomerId: z.string(),
            }),
          }),
        },
      },
      description: "Customers merged",
    },
    400: {
      content: { "application/json": { schema: errorResponseSchema } },
      description: "Bad request",
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

export function registerPostMergeCustomer(api: OpenAPIHono<AppRouteEnv>) {
  return api.openapi(mergeCustomerRoute, async (c) => {
    const db = c.get("db");
    const user = c.get("user");

    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const { id: targetCustomerId } = c.req.valid("param");
    const { sourceCustomerId } = c.req.valid("json");

    if (targetCustomerId === sourceCustomerId) {
      return c.json({ error: "Cannot merge the same customer" }, 400);
    }

    const targetCustomer = await getCustomerById(db, targetCustomerId);
    const sourceCustomer = await getCustomerById(db, sourceCustomerId);
    if (!targetCustomer || !sourceCustomer) {
      return c.json({ error: "Not found" }, 404);
    }

    if (String(targetCustomer.orgId) !== String(sourceCustomer.orgId)) {
      return c.json({ error: "Customers must belong to the same organization" }, 400);
    }

    if (!(await ensureOrgAccess(db, targetCustomer.orgId, user.id))) {
      return c.json({ error: "Forbidden" }, 403);
    }

    const mergedNotes = [targetCustomer.notes, sourceCustomer.notes]
      .map((entry) => entry.trim())
      .filter((entry, index, list) => entry.length > 0 && list.indexOf(entry) === index)
      .join("\n\n");

    await db.transaction(async (tx) => {
      await tx
        .update(emails)
        .set({ customerId: targetCustomerId })
        .where(eq(emails.customerId, sourceCustomerId));
      await tx
        .update(reminders)
        .set({ customerId: targetCustomerId })
        .where(eq(reminders.customerId, sourceCustomerId));
      await tx
        .update(customers)
        .set({
          company: targetCustomer.company ?? sourceCustomer.company,
          phone: targetCustomer.phone ?? sourceCustomer.phone,
          notes: mergedNotes || targetCustomer.notes,
          updatedAt: Date.now(),
        })
        .where(eq(customers.id, targetCustomerId));
      await tx.delete(customers).where(eq(customers.id, sourceCustomerId));
    });

    const updatedTarget = await getCustomerById(db, targetCustomerId);
    if (!updatedTarget) {
      return c.json({ error: "Not found" }, 404);
    }

    return c.json(
      {
        data: {
          targetCustomer: toCustomerResponse(updatedTarget),
          mergedCustomerId: sourceCustomerId,
        },
      },
      200,
    );
  });
}
