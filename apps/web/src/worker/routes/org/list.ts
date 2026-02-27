import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import type { AppRouteEnv } from "../types";
import { listOrganizationsResponseSchema } from "./schemas";
import { listOrganizationsForUser } from "./service";

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
    const user = c.get("user");

    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const data = await listOrganizationsForUser(c.get("db"), user.id);

    return c.json({ data }, 200);
  });
}
