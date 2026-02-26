import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";
import { reminders } from "../../db/schema";
import { ensureOrgAccess } from "../../lib/access";
import type { AppRouteEnv } from "../types";
import { errorResponseSchema, updateReminderParamsSchema } from "./schemas";
import { getReminderById } from "./service";

const deleteReminderRoute = createRoute({
  method: "delete",
  path: "/:id",
  tags: ["reminders"],
  request: {
    params: updateReminderParamsSchema,
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({ data: z.object({ id: z.string() }) }),
        },
      },
      description: "Reminder deleted",
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

export function registerDeleteReminder(api: OpenAPIHono<AppRouteEnv>) {
  return api.openapi(deleteReminderRoute, async (c) => {
    const db = c.get("db");
    const user = c.get("user");

    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const { id } = c.req.valid("param");
    const reminder = await getReminderById(db, id);
    if (!reminder) return c.json({ error: "Not found" }, 404);

    if (!(await ensureOrgAccess(db, reminder.orgId, user.id))) {
      return c.json({ error: "Forbidden" }, 403);
    }

    await db.delete(reminders).where(eq(reminders.id, id));
    return c.json({ data: { id } }, 200);
  });
}
