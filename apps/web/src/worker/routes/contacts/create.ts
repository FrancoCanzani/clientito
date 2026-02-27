import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { contacts, customers, emails } from "../../db/schema";
import { ensureOrgAccess } from "../../lib/access";
import { resolveCustomerName } from "../../lib/customer-name";
import type { AppRouteEnv } from "../types";
import {
  createCustomersFromContactsRequestSchema,
  createCustomersFromContactsResponseSchema,
  errorResponseSchema,
} from "./schemas";

const createCustomersFromContactsRoute = createRoute({
  method: "post",
  path: "/",
  tags: ["contacts"],
  summary: "Create customers from selected contacts",
  request: {
    body: {
      content: {
        "application/json": {
          schema: createCustomersFromContactsRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: createCustomersFromContactsResponseSchema,
        },
      },
      description: "Customers created from contacts",
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

export function registerPostContacts(api: OpenAPIHono<AppRouteEnv>) {
  return api.openapi(createCustomersFromContactsRoute, async (c) => {
    const db = c.get("db");
    const user = c.get("user");

    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const { orgId, emails: emailList } = c.req.valid("json");
    if (!(await ensureOrgAccess(db, orgId, user.id))) {
      return c.json({ error: "Forbidden" }, 403);
    }

    const matchedContacts = await db
      .select({
        email: contacts.email,
        name: contacts.name,
        domain: contacts.domain,
      })
      .from(contacts)
      .where(
        and(eq(contacts.orgId, orgId), inArray(contacts.email, emailList)),
      );

    const contactMap = new Map(
      matchedContacts.map((c) => [c.email, c]),
    );

    let customersCreated = 0;
    let emailsLinked = 0;
    const now = Date.now();

    for (const email of emailList) {
      const contact = contactMap.get(email);
      const name = resolveCustomerName(contact?.name, email);
      const company = contact?.domain ?? null;

      const inserted = await db
        .insert(customers)
        .values({
          orgId,
          name,
          email,
          company,
          notes: "",
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoNothing({
          target: [customers.orgId, customers.email],
        })
        .returning({ id: customers.id });

      if (inserted.length > 0) {
        customersCreated += 1;
        const customerId = inserted[0].id;

        const linked = await db
          .update(emails)
          .set({ customerId, isCustomer: true })
          .where(
            and(
              eq(emails.orgId, orgId),
              isNull(emails.customerId),
              or(
                sql`lower(${emails.fromAddr}) = ${email}`,
                sql`lower(${emails.toAddr}) = ${email}`,
              ),
            ),
          )
          .returning({ id: emails.id });

        emailsLinked += linked.length;
      }
    }

    return c.json(
      { data: { customersCreated, emailsLinked } },
      200,
    );
  });
}
