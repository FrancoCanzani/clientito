import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { and, eq } from "drizzle-orm";
import { orgMembers } from "../../db/schema";
import type { AppRouteEnv } from "../types";
import {
  classifyRequestSchema,
  classifyResponseSchema,
  errorResponseSchema,
} from "./schemas";
import { classifyOrgEmails } from "./service";

const classifyRoute = createRoute({
  method: "post",
  path: "/",
  tags: ["classification"],
  summary: "Classify pending emails for an organization",
  request: {
    body: {
      content: {
        "application/json": {
          schema: classifyRequestSchema,
        },
      },
      required: true,
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: classifyResponseSchema,
        },
      },
      description: "Classification batch completed",
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
  },
});

export function registerPostClassify(api: OpenAPIHono<AppRouteEnv>) {
  return api.openapi(classifyRoute, async (c) => {
    const db = c.get("db");
    const user = c.get("user");

    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const { orgId, limit } = c.req.valid("json");
    const membership = await db.query.orgMembers.findFirst({
      where: and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, user.id)),
    });

    if (!membership) {
      return c.json({ error: "Forbidden" }, 403);
    }

    const result = await classifyOrgEmails(
      db,
      c.env,
      orgId,
      limit ?? 20,
    );
    return c.json({ data: result }, 200);
  });
}
