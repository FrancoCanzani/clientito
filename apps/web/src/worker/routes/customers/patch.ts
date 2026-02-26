import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";
import { customers } from "../../db/schema";
import { ensureOrgAccess } from "../../lib/access";
import type { AppRouteEnv } from "../types";
import { toCustomerResponse } from "./helpers";
import {
  customerIdParamsSchema,
  customerSchema,
  errorResponseSchema,
  patchCustomerRequestSchema,
} from "./schemas";
import { getCustomerById } from "./service";

const patchCustomerRoute = createRoute({
  method: "patch",
  path: "/:id",
  tags: ["customers"],
  summary: "Update customer",
  request: {
    params: customerIdParamsSchema,
    body: {
      content: {
        "application/json": {
          schema: patchCustomerRequestSchema,
        },
      },
      required: true,
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({ data: customerSchema }),
        },
      },
      description: "Customer updated",
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

export function registerPatchCustomer(api: OpenAPIHono<AppRouteEnv>) {
  return api.openapi(patchCustomerRoute, async (c) => {
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

    const payload = c.req.valid("json");
    const updates: Partial<{
      name: string;
      company: string | null;
      phone: string | null;
      website: string | null;
      vatEin: string | null;
      address: string | null;
      notes: string;
      updatedAt: number;
    }> = {
      updatedAt: Date.now(),
    };

    if (payload.name !== undefined) updates.name = payload.name.trim();
    if (payload.company !== undefined) {
      updates.company = payload.company === null ? null : payload.company.trim() || null;
    }
    if (payload.phone !== undefined) {
      updates.phone = payload.phone === null ? null : payload.phone.trim() || null;
    }
    if (payload.website !== undefined) {
      updates.website = payload.website === null ? null : payload.website.trim() || null;
    }
    if (payload.vatEin !== undefined) {
      updates.vatEin = payload.vatEin === null ? null : payload.vatEin.trim() || null;
    }
    if (payload.address !== undefined) {
      updates.address = payload.address === null ? null : payload.address.trim() || null;
    }
    if (payload.notes !== undefined) updates.notes = payload.notes;

    const hasEditableField = Object.keys(updates).some((key) => key !== "updatedAt");
    if (!hasEditableField) {
      return c.json({ error: "No fields to update" }, 400);
    }

    await db.update(customers).set(updates).where(eq(customers.id, id));
    const updated = await getCustomerById(db, id);

    if (!updated) {
      return c.json({ error: "Not found" }, 404);
    }

    return c.json({ data: toCustomerResponse(updated) }, 200);
  });
}
