import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";
import { reminders } from "../../db/schema";
import { ensureOrgAccess } from "../../lib/access";
import type { AppRouteEnv } from "../types";
import { toReminderResponse } from "./helpers";
import {
  errorResponseSchema,
  reminderSchema,
  updateReminderParamsSchema,
  updateReminderRequestSchema,
} from "./schemas";
import { getReminderById } from "./service";

const updateReminderRoute = createRoute({
  method: "patch",
  path: "/:id",
  tags: ["reminders"],
  request: {
    params: updateReminderParamsSchema,
    body: {
      content: {
        "application/json": {
          schema: updateReminderRequestSchema,
        },
      },
      required: true,
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({ data: reminderSchema }),
        },
      },
      description: "Reminder updated",
    },
    400: {
      content: { "application/json": { schema: errorResponseSchema } },
      description: "Bad request",
    },
    401: {
      content: { "application/json": { schema: errorResponseSchema } },
      description: "Unauthorized",
    },
    403: {
      content: { "application/json": { schema: errorResponseSchema } },
      description: "Forbidden",
    },
    404: {
      content: { "application/json": { schema: errorResponseSchema } },
      description: "Not found",
    },
  },
});

export function registerPatchReminder(api: OpenAPIHono<AppRouteEnv>) {
  return api.openapi(updateReminderRoute, async (c) => {
    const db = c.get("db");
    const user = c.get("user");

    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const { id } = c.req.valid("param");
    const reminder = await getReminderById(db, id);
    if (!reminder) return c.json({ error: "Not found" }, 404);

    if (!(await ensureOrgAccess(db, reminder.orgId, user.id))) {
      return c.json({ error: "Forbidden" }, 403);
    }

    const payload = c.req.valid("json");
    const updates: Partial<{ message: string; dueAt: number; done: boolean }> = {};
    if (payload.message !== undefined) updates.message = payload.message;
    if (payload.dueAt !== undefined) updates.dueAt = payload.dueAt;
    if (payload.done !== undefined) updates.done = payload.done;

    if (Object.keys(updates).length === 0) {
      return c.json({ error: "No fields to update" }, 400);
    }

    await db.update(reminders).set(updates).where(eq(reminders.id, id));
    const updated = await getReminderById(db, id);

    return c.json({ data: toReminderResponse(updated!) }, 200);
  });
}
