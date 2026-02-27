import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { reminders } from "../../db/schema";
import { ensureOrgAccess } from "../../lib/access";
import type { AppRouteEnv } from "../types";
import { toReminderResponse } from "./helpers";
import {
  createReminderRequestSchema,
  errorResponseSchema,
  reminderSchema,
} from "./schemas";

const createReminderRoute = createRoute({
  method: "post",
  path: "/",
  tags: ["reminders"],
  request: {
    body: {
      content: {
        "application/json": {
          schema: createReminderRequestSchema,
        },
      },
      required: true,
    },
  },
  responses: {
    201: {
      content: {
        "application/json": {
          schema: z.object({ data: reminderSchema }),
        },
      },
      description: "Reminder created",
    },
    401: {
      content: { "application/json": { schema: errorResponseSchema } },
      description: "Unauthorized",
    },
    403: {
      content: { "application/json": { schema: errorResponseSchema } },
      description: "Forbidden",
    },
  },
});

export function registerPostReminder(api: OpenAPIHono<AppRouteEnv>) {
  return api.openapi(createReminderRoute, async (c) => {
    const db = c.get("db");
    const user = c.get("user");

    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const { orgId, customerId, message, dueAt } = c.req.valid("json");
    if (!(await ensureOrgAccess(db, orgId, user.id))) {
      return c.json({ error: "Forbidden" }, 403);
    }

    const now = Date.now();
    const inserted = await db
      .insert(reminders)
      .values({
        orgId,
        customerId,
        userId: user.id,
        message,
        dueAt,
        done: false,
        createdAt: now,
      })
      .returning();

    return c.json({ data: toReminderResponse(inserted[0]!) }, 201);
  });
}
