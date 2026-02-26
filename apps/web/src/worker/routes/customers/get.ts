import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { asc, desc, eq } from "drizzle-orm";
import { emails, reminders } from "../../db/schema";
import { ensureOrgAccess } from "../../lib/access";
import type { AppRouteEnv } from "../types";
import {
  customerContactSchema,
  customerIdParamsSchema,
  customerSchema,
  emailSchema,
  errorResponseSchema,
  reminderSchema,
} from "./schemas";
import {
  toCustomerEmailResponse,
  toCustomerReminderResponse,
  toCustomerResponse,
} from "./helpers";
import { getCustomerContacts, getCustomerById } from "./service";

const getCustomerRoute = createRoute({
  method: "get",
  path: "/:id",
  tags: ["customers"],
  summary: "Get customer detail with emails and reminders",
  request: {
    params: customerIdParamsSchema,
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({
            data: z.object({
              customer: customerSchema,
              emails: z.array(emailSchema),
              reminders: z.array(reminderSchema),
              contacts: z.array(customerContactSchema),
            }),
          }),
        },
      },
      description: "Customer detail",
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

export function registerGetCustomerById(api: OpenAPIHono<AppRouteEnv>) {
  return api.openapi(getCustomerRoute, async (c) => {
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

    const customerEmails = await db
      .select()
      .from(emails)
      .where(eq(emails.customerId, id))
      .orderBy(desc(emails.date));

    const customerReminders = await db
      .select()
      .from(reminders)
      .where(eq(reminders.customerId, id))
      .orderBy(asc(reminders.dueAt));

    const customerContacts = await getCustomerContacts(
      db,
      customer,
      customerEmails,
      user.email,
    );

    return c.json(
      {
        data: {
          customer: toCustomerResponse(customer),
          emails: customerEmails.map(toCustomerEmailResponse),
          reminders: customerReminders.map(toCustomerReminderResponse),
          contacts: customerContacts,
        },
      },
      200,
    );
  });
}
