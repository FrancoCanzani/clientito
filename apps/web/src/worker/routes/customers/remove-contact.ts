import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { ensureOrgAccess } from "../../lib/access";
import { normalizeEmailAddress } from "../../lib/customer-name";
import type { AppRouteEnv } from "../types";
import {
  customerContactParamsSchema,
  errorResponseSchema,
  mutateCustomerContactResponseSchema,
} from "./schemas";
import { getCustomerById, unlinkContactFromCustomer } from "./service";

const removeCustomerContactRoute = createRoute({
  method: "delete",
  path: "/:id/contacts/:email",
  tags: ["customers"],
  summary: "Unlink contact email from customer",
  request: {
    params: customerContactParamsSchema,
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: mutateCustomerContactResponseSchema,
        },
      },
      description: "Contact unlinked",
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

export function registerDeleteCustomerContact(api: OpenAPIHono<AppRouteEnv>) {
  return api.openapi(removeCustomerContactRoute, async (c) => {
    const db = c.get("db");
    const user = c.get("user");

    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const { id, email } = c.req.valid("param");
    const customer = await getCustomerById(db, id);
    if (!customer) {
      return c.json({ error: "Not found" }, 404);
    }

    if (!(await ensureOrgAccess(db, customer.orgId, user.id))) {
      return c.json({ error: "Forbidden" }, 403);
    }

    const contactEmail = normalizeEmailAddress(email);

    const emailsLinked = await unlinkContactFromCustomer(db, {
      orgId: customer.orgId,
      customerId: customer.id,
      email: contactEmail,
    });

    return c.json(
      {
        data: {
          email: contactEmail,
          emailsLinked,
        },
      },
      200,
    );
  });
}
