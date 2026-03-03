import { createRoute, OpenAPIHono } from "@hono/zod-openapi";
import { sendGmailMessage } from "../../lib/gmail/send";
import { createTimer } from "../../lib/timing";
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
    200: {
      content: {
        "application/json": {
          schema: sendEmailResponseSchema,
        },
      },
      description: "Email sent",
    },
    401: {
      content: { "application/json": { schema: errorResponseSchema } },
      description: "Unauthorized",
    },
    500: {
      content: { "application/json": { schema: errorResponseSchema } },
      description: "Send failed",
    },
  },
});

export function registerPostEmail(api: OpenAPIHono<AppRouteEnv>) {
  api.openapi(postSendEmailRoute, async (c) => {
    const db = c.get("db");
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    const timer = createTimer("emails-send", { userId: user.id });

    const input = c.req.valid("json");
    timer.mark("payload-validated");

    try {
      const result = await sendGmailMessage(db, c.env, user.id, user.email, input);
      timer.mark("gmail-send");

      timer.end({ to: input.to, hasThreadId: Boolean(input.threadId) });
      return c.json(
        { data: { gmailId: result.gmailId, threadId: result.threadId } },
        200,
      );
    } catch (error) {
      console.error("Failed to send email", { userId: user.id, error });
      timer.end({ failed: true });
      return c.json(
        { error: error instanceof Error ? error.message : "Failed to send email" },
        500,
      );
    }
  });
}
