import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { eq } from "drizzle-orm";
import { user } from "../../db/auth-schema";
import type { AppRouteEnv } from "../types";

const errorResponseSchema = z.object({ error: z.string() });

const deleteAccountRoute = createRoute({
  method: "delete",
  path: "/account",
  tags: ["settings"],
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({ data: z.object({ deleted: z.boolean() }) }),
        },
      },
      description: "Account deleted",
    },
    401: {
      content: { "application/json": { schema: errorResponseSchema } },
      description: "Unauthorized",
    },
  },
});

export function registerDeleteAccount(api: OpenAPIHono<AppRouteEnv>) {
  api.openapi(deleteAccountRoute, async (c) => {
    const db = c.get("db");
    const currentUser = c.get("user");
    if (!currentUser) return c.json({ error: "Unauthorized" }, 401);

    await db.delete(user).where(eq(user.id, currentUser.id));

    return c.json({ data: { deleted: true } }, 200);
  });
}
