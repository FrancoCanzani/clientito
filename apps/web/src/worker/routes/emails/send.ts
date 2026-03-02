import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import type { AppRouteEnv } from "../types";
import {
  errorResponseSchema,
  sendEmailBodySchema,
  sendEmailResponseSchema,
} from "./schemas";

const postSendEmailRoute = createRoute({
  method: "post",
  path: "/send",
  tags: ["emails"],
  request: {
    body: {
      content: {
        "application/json": {
          schema: sendEmailBodySchema,
        },
      },
      required: true,
    },
  },
  responses: {
    501: {
      content: {
        "application/json": {
          schema: sendEmailResponseSchema,
        },
      },
      description: "Not implemented",
    },
    401: {
      content: { "application/json": { schema: errorResponseSchema } },
      description: "Unauthorized",
    },
  },
});

export function registerPostSendEmail(api: OpenAPIHono<AppRouteEnv>) {
  return api.openapi(postSendEmailRoute, async (c) => {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    c.req.valid("json");

    return c.json(
      {
        data: {
          status: "not_implemented",
          message: "Email send endpoint will be wired in Phase 5 via gmail-send.ts",
        },
      },
      501,
    );
  });
}
