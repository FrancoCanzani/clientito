import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import type { AppRouteEnv } from "../types";
import {
  updateOrganizationRequestSchema,
  updateOrganizationResponseSchema,
} from "./schemas";
import { updateOrganizationForOwner } from "./service";

const errorResponseSchema = z.object({
  error: z.string(),
});

const route = createRoute({
  method: "patch",
  path: "/:orgId",
  tags: ["organizations"],
  summary: "Update organization",
  request: {
    params: z.object({
      orgId: z.string().trim().min(1, "orgId is required"),
    }),
    body: {
      content: {
        "application/json": {
          schema: updateOrganizationRequestSchema,
        },
      },
      required: true,
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: updateOrganizationResponseSchema,
        },
      },
      description: "Organization updated",
    },
    401: {
      content: {
        "application/json": {
          schema: errorResponseSchema,
        },
      },
      description: "Unauthorized",
    },
    403: {
      content: {
        "application/json": {
          schema: errorResponseSchema,
        },
      },
      description: "Forbidden",
    },
    404: {
      content: {
        "application/json": {
          schema: errorResponseSchema,
        },
      },
      description: "Not found",
    },
  },
});

export function registerPatchOrganization(api: OpenAPIHono<AppRouteEnv>) {
  return api.openapi(route, async (c) => {
    const user = c.get("user");

    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const { orgId } = c.req.valid("param");
    const payload = c.req.valid("json");

    const result = await updateOrganizationForOwner(
      c.get("db"),
      user.id,
      orgId,
      payload.name,
    );

    if (result.status === "forbidden") {
      return c.json({ error: "Forbidden" }, 403);
    }

    if (result.status === "not_found") {
      return c.json({ error: "Organization not found" }, 404);
    }

    return c.json({ data: result.data }, 200);
  });
}
