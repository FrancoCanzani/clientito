import type { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { and, eq } from "drizzle-orm";
import { companies } from "../../db/schema";
import type { AppRouteEnv } from "../types";
import { companyIdParamsSchema, patchCompanyBodySchema } from "./schemas";

export function registerPatchCompanies(api: Hono<AppRouteEnv>) {
  return api.patch(
    "/:id",
    zValidator("param", companyIdParamsSchema),
    zValidator("json", patchCompanyBodySchema),
    async (c) => {
      const db = c.get("db");
      const user = c.get("user")!;

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
    },
  );
}
