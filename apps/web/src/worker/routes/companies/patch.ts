import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { and, eq } from "drizzle-orm";
import { companies } from "../../db/schema";
import type { AppRouteEnv } from "../types";
import {
  companyIdParamsSchema,
  errorResponseSchema,
  patchCompanyBodySchema,
  patchCompanyResponseSchema,
} from "./schemas";

const patchCompanyRoute = createRoute({
  method: "patch",
  path: "/:id",
  tags: ["companies"],
  request: {
    params: companyIdParamsSchema,
    body: {
      content: {
        "application/json": {
          schema: patchCompanyBodySchema,
        },
      },
      required: true,
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: patchCompanyResponseSchema,
        },
      },
      description: "Updated",
    },
    401: {
      content: { "application/json": { schema: errorResponseSchema } },
      description: "Unauthorized",
    },
    404: {
      content: { "application/json": { schema: errorResponseSchema } },
      description: "Not found",
    },
  },
});

export function registerPatchCompanies(api: OpenAPIHono<AppRouteEnv>) {
  return api.openapi(patchCompanyRoute, async (c) => {
    const db = c.get("db");
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const { id } = c.req.valid("param");
    const { name, industry, website, description } = c.req.valid("json");

    const existing = await db
      .select({ id: companies.id })
      .from(companies)
      .where(and(eq(companies.id, id), eq(companies.userId, user.id)))
      .limit(1);
    if (!existing[0]) return c.json({ error: "Company not found" }, 404);

    const updateData: Partial<typeof companies.$inferInsert> = {};
    if (name !== undefined) updateData.name = name;
    if (industry !== undefined) updateData.industry = industry;
    if (website !== undefined) updateData.website = website;
    if (description !== undefined) updateData.description = description;

    if (Object.keys(updateData).length > 0) {
      await db
        .update(companies)
        .set(updateData)
        .where(and(eq(companies.id, id), eq(companies.userId, user.id)));
    }

    const rows = await db
      .select({
        id: companies.id,
        domain: companies.domain,
        name: companies.name,
        industry: companies.industry,
        website: companies.website,
        description: companies.description,
        createdAt: companies.createdAt,
      })
      .from(companies)
      .where(and(eq(companies.id, id), eq(companies.userId, user.id)))
      .limit(1);

    return c.json({ data: rows[0]! }, 200);
  });
}
