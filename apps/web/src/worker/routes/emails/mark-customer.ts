import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { and, eq, sql } from "drizzle-orm";
import { customers, emails } from "../../db/schema";
import { ensureOrgAccess } from "../../lib/access";
import { resolveCustomerName } from "../../lib/customer-name";
import { extractCustomerFromEmail } from "../classify/service";
import type { AppRouteEnv } from "../types";
import { normalizeEmailAddress } from "./helpers";
import {
  errorResponseSchema,
  markAsCustomerRequestSchema,
  markAsCustomerResponseSchema,
} from "./schemas";

const markAsCustomerRoute = createRoute({
  method: "post",
  path: "/mark-customer",
  tags: ["emails"],
  request: {
    body: {
      content: {
        "application/json": {
          schema: markAsCustomerRequestSchema,
        },
      },
      required: true,
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: markAsCustomerResponseSchema,
        },
      },
      description: "Customer created and emails linked",
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

export function registerPostMarkAsCustomer(api: OpenAPIHono<AppRouteEnv>) {
  return api.openapi(markAsCustomerRoute, async (c) => {
    const db = c.get("db");
    const user = c.get("user");

    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const { orgId, emailAddress, name, company } = c.req.valid("json");
    if (!(await ensureOrgAccess(db, orgId, user.id))) {
      return c.json({ error: "Forbidden" }, 403);
    }

    const normalizedEmail = normalizeEmailAddress(emailAddress);

    let resolvedName = name ?? null;
    let resolvedCompany = company ?? null;

    if (!resolvedName && !resolvedCompany) {
      const recentEmail = await db.query.emails.findFirst({
        where: and(
          eq(emails.orgId, orgId),
          sql`lower(${emails.fromAddr}) = ${normalizedEmail}`,
        ),
      });

      if (recentEmail) {
        const extracted = await extractCustomerFromEmail(
          c.env,
          recentEmail.fromAddr,
          recentEmail.subject,
          recentEmail.bodyText ?? recentEmail.snippet,
        );

        resolvedName = extracted.name;
        resolvedCompany = extracted.company;
      }
    }

    const now = Date.now();
    const resolvedCustomerName = resolveCustomerName(resolvedName, normalizedEmail);
    await db
      .insert(customers)
      .values({
        orgId,
        name: resolvedCustomerName,
        company: resolvedCompany,
        email: normalizedEmail,
        phone: null,
        notes: "",
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing({ target: [customers.orgId, customers.email] });

    const customer = await db.query.customers.findFirst({
      where: and(eq(customers.orgId, orgId), eq(customers.email, normalizedEmail)),
    });

    if (!customer) {
      return c.json({ error: "Failed to create customer" }, 500 as never);
    }

    if (resolvedName || resolvedCompany) {
      const nextName = resolveCustomerName(resolvedName ?? customer.name, normalizedEmail);
      await db
        .update(customers)
        .set({
          name: nextName,
          company: resolvedCompany ?? customer.company,
          updatedAt: now,
        })
        .where(eq(customers.id, customer.id));
    }

    const linked = await db
      .update(emails)
      .set({ customerId: customer.id, isCustomer: true, classified: true })
      .where(
        and(
          eq(emails.orgId, orgId),
          sql`lower(${emails.fromAddr}) = ${normalizedEmail}`,
        ),
      )
      .returning({ id: emails.id });

    const linkedTo = await db
      .update(emails)
      .set({ customerId: customer.id })
      .where(
        and(
          eq(emails.orgId, orgId),
          sql`lower(${emails.toAddr}) = ${normalizedEmail}`,
          sql`${emails.customerId} IS NULL`,
        ),
      )
      .returning({ id: emails.id });

    return c.json(
      {
        data: {
          customerId: String(customer.id),
          emailsLinked: linked.length + linkedTo.length,
        },
      },
      200,
    );
  });
}
