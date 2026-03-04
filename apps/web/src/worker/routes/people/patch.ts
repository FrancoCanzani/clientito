import type { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { and, eq } from "drizzle-orm";
import { companies, people } from "../../db/schema";
import type { AppRouteEnv } from "../types";
import { patchPersonBodySchema, personIdParamsSchema } from "./schemas";

export function registerPatchPeople(api: Hono<AppRouteEnv>) {
  return api.patch(
    "/:id",
    zValidator("param", personIdParamsSchema),
    zValidator("json", patchPersonBodySchema),
    async (c) => {
      const db = c.get("db");
      const user = c.get("user")!;

      const { id } = c.req.valid("param");
      const { name, phone, title, linkedin, companyId } = c.req.valid("json");

      const existing = await db
        .select({ id: people.id })
        .from(people)
        .where(and(eq(people.id, id), eq(people.userId, user.id)))
        .limit(1);
      if (!existing[0]) return c.json({ error: "Person not found" }, 404);

      if (companyId !== undefined && companyId !== null) {
        const company = await db
          .select({ id: companies.id })
          .from(companies)
          .where(and(eq(companies.id, companyId), eq(companies.userId, user.id)))
          .limit(1);
        if (!company[0]) return c.json({ error: "Company not found" }, 404);
      }

      const updateData: Partial<typeof people.$inferInsert> = {};
      if (name !== undefined) updateData.name = name;
      if (phone !== undefined) updateData.phone = phone;
      if (title !== undefined) updateData.title = title;
      if (linkedin !== undefined) updateData.linkedin = linkedin;
      if (companyId !== undefined) updateData.companyId = companyId;

      if (Object.keys(updateData).length > 0) {
        await db
          .update(people)
          .set(updateData)
          .where(and(eq(people.id, id), eq(people.userId, user.id)));
      }

      const rows = await db
        .select({
          id: people.id,
          email: people.email,
          name: people.name,
          phone: people.phone,
          title: people.title,
          linkedin: people.linkedin,
          companyId: people.companyId,
          companyName: companies.name,
          companyDomain: companies.domain,
          lastContactedAt: people.lastContactedAt,
          createdAt: people.createdAt,
        })
        .from(people)
        .leftJoin(
          companies,
          and(eq(companies.id, people.companyId), eq(companies.userId, user.id)),
        )
        .where(and(eq(people.id, id), eq(people.userId, user.id)))
        .limit(1);

      return c.json({ data: rows[0]! }, 200);
    },
  );
}
