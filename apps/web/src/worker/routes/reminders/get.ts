import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { and, asc, eq } from "drizzle-orm";
import { reminders } from "../../db/schema";
import { ensureOrgAccess } from "../../lib/access";
import type { AppRouteEnv } from "../types";
import {
  errorResponseSchema,
  listRemindersQuerySchema,
  reminderSchema,
} from "./schemas";
import { toReminderResponse } from "./helpers";

const listRemindersRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["reminders"],
  request: {
    query: listRemindersQuerySchema,
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({ data: z.array(reminderSchema) }),
        },
      },
      description: "Reminders list",
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

export function registerGetReminders(api: OpenAPIHono<AppRouteEnv>) {
  return api.openapi(listRemindersRoute, async (c) => {
    const db = c.get("db");
    const user = c.get("user");

    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const { orgId, done } = c.req.valid("query");
    if (!(await ensureOrgAccess(db, orgId, user.id))) {
      return c.json({ error: "Forbidden" }, 403);
    }

    const conditions = [eq(reminders.orgId, orgId)];
    if (done === "true") conditions.push(eq(reminders.done, true));
    if (done === "false") conditions.push(eq(reminders.done, false));

    const rows = await db
      .select()
      .from(reminders)
      .where(and(...conditions))
      .orderBy(asc(reminders.dueAt));

    return c.json({ data: rows.map(toReminderResponse) }, 200);
  });
}
