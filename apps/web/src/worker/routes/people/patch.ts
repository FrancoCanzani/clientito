import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { and, eq } from "drizzle-orm";
import { companies, people } from "../../db/schema";
import type { AppRouteEnv } from "../types";
import {
  errorResponseSchema,
  patchPersonBodySchema,
  patchPersonResponseSchema,
  personIdParamsSchema,
} from "./schemas";

const patchPersonRoute = createRoute({
  method: "patch",
  path: "/:id",
  tags: ["people"],
  request: {
    params: personIdParamsSchema,
    body: {
      content: {
        "application/json": {
          schema: patchPersonBodySchema,
        },
      },
      required: true,
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: patchPersonResponseSchema,
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

export function registerPatchPeople(api: OpenAPIHono<AppRouteEnv>) {
  return api.openapi(patchPersonRoute, async (c) => {
    const db = c.get("db");
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const { id } = c.req.valid("param");
    const { name, phone, title, linkedin, companyId } = c.req.valid("json");

    const existing = await db
      .select({ id: people.id })
      .from(people)
      .where(and(eq(people.id, id), eq(people.userId, user.id)))
      .limit(1);
    if (!existing[0]) return c.json({ error: "Person not found" }, 404);

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
  });
}
