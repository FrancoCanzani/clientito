import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { asc, eq } from "drizzle-orm";
import { orgMembers, organizations } from "../../db/schema";
import type { AppRouteEnv } from "../types";
import { listOrganizationsResponseSchema } from "./schemas";

const errorResponseSchema = z.object({
  error: z.string(),
});

const route = createRoute({
  method: "get",
  path: "/",
  tags: ["organizations"],
  summary: "List organizations for current user",
  responses: {
    200: {
      content: {
        "application/json": {
          schema: listOrganizationsResponseSchema,
        },
      },
      description: "List of organizations",
    },
    401: {
      content: {
        "application/json": {
          schema: errorResponseSchema,
        },
      },
      description: "Unauthorized",
    },
  },
});

export function registerGetOrganizations(api: OpenAPIHono<AppRouteEnv>) {
  return api.openapi(route, async (c) => {
    const db = c.get("db");
    const user = c.get("user");

    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const data = await db
      .select({
        id: organizations.id,
        name: organizations.name,
        slug: organizations.slug,
        role: orgMembers.role,
        createdAt: organizations.createdAt,
      })
      .from(orgMembers)
      .innerJoin(organizations, eq(orgMembers.orgId, organizations.id))
      .where(eq(orgMembers.userId, user.id))
      .orderBy(asc(organizations.name));

    return c.json(
      {
        data: data.map((org) => ({
          ...org,
          id: String(org.id),
        })),
      },
      200
    );
  });
}
