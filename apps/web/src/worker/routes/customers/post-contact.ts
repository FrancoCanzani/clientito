import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { ensureOrgAccess } from "../../lib/access";
import { normalizeEmailAddress } from "../../lib/customer-name";
import type { AppRouteEnv } from "../types";
import {
  addCustomerContactRequestSchema,
  customerIdParamsSchema,
  errorResponseSchema,
  mutateCustomerContactResponseSchema,
} from "./schemas";
import { getCustomerById, linkContactToCustomer } from "./service";

const addCustomerContactRoute = createRoute({
  method: "post",
  path: "/:id/contacts",
  tags: ["customers"],
  summary: "Link contact email to customer",
  request: {
    params: customerIdParamsSchema,
    body: {
      content: {
        "application/json": {
          schema: addCustomerContactRequestSchema,
        },
      },
      required: true,
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: mutateCustomerContactResponseSchema,
        },
      },
      description: "Contact linked",
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

export function registerPostCustomerContact(api: OpenAPIHono<AppRouteEnv>) {
  return api.openapi(addCustomerContactRoute, async (c) => {
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
    const contactEmail = normalizeEmailAddress(payload.email);
    const userEmail = user.email ? normalizeEmailAddress(user.email) : null;

    if (userEmail && contactEmail === userEmail) {
      return c.json({ error: "Cannot link your own email as a customer contact" }, 400);
    }

    const emailsLinked = await linkContactToCustomer(db, {
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
