import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { and, eq } from "drizzle-orm";
import { companies, people } from "../../db/schema";
import type { AppRouteEnv } from "../types";
import {
  createPersonBodySchema,
  createPersonResponseSchema,
  errorResponseSchema,
} from "./schemas";

const postPersonRoute = createRoute({
  method: "post",
  path: "/",
  tags: ["people"],
  request: {
    body: {
      content: {
        "application/json": {
          schema: createPersonBodySchema,
        },
      },
      required: true,
    },
  },
  responses: {
    201: {
      content: {
        "application/json": {
          schema: createPersonResponseSchema,
        },
      },
      description: "Created",
    },
    401: {
      content: { "application/json": { schema: errorResponseSchema } },
      description: "Unauthorized",
    },
  },
});

export function registerPostPeople(api: OpenAPIHono<AppRouteEnv>) {
  return api.openapi(postPersonRoute, async (c) => {
    const db = c.get("db");
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const { email, name, phone, title, linkedin, companyId } = c.req.valid("json");
    const now = Date.now();

    const inserted = await db
      .insert(people)
      .values({
        userId: user.id,
        email,
        name: name ?? null,
        phone: phone ?? null,
        title: title ?? null,
        linkedin: linkedin ?? null,
        companyId: companyId ?? null,
        createdAt: now,
      })
      .returning({ id: people.id });

    const createdId = inserted[0]!.id;

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
      .where(and(eq(people.id, createdId), eq(people.userId, user.id)))
      .limit(1);

    return c.json({ data: rows[0]! }, 201);
  });
}
