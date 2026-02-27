import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import type { AppRouteEnv } from "../types";
import {
  createOrganizationRequestSchema,
  createOrganizationResponseSchema,
} from "./schemas";
import { createOrganizationForUser } from "./service";

const errorResponseSchema = z.object({
  error: z.string(),
});

const route = createRoute({
  method: "post",
  path: "/",
  tags: ["organizations"],
  summary: "Create organization",
  request: {
    body: {
      content: {
        "application/json": {
          schema: createOrganizationRequestSchema,
        },
      },
      required: true,
    },
  },
  responses: {
    201: {
      content: {
        "application/json": {
          schema: createOrganizationResponseSchema,
        },
      },
      description: "Organization created",
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

export function registerPostOrganization(api: OpenAPIHono<AppRouteEnv>) {
  return api.openapi(route, async (c) => {
    const user = c.get("user");

    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const payload = c.req.valid("json");
    const data = await createOrganizationForUser(c.get("db"), user.id, payload.name);

    return c.json({ data }, 201);
  });
}
