import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import type { AppRouteEnv } from "../types";
import { buildDashboardBriefingPayload } from "./briefing-content";

const errorResponseSchema = z.object({ error: z.string() });
const briefingResponseSchema = z.object({
  data: z.object({
    text: z.string(),
  }),
});

const getBriefingRoute = createRoute({
  method: "get",
  path: "/briefing",
  tags: ["dashboard"],
  responses: {
    200: {
      content: {
        "application/json": {
          schema: briefingResponseSchema,
        },
      },
      description: "Dashboard briefing",
    },
    401: {
      content: { "application/json": { schema: errorResponseSchema } },
      description: "Unauthorized",
    },
  },
});

export function registerGetBriefing(app: OpenAPIHono<AppRouteEnv>) {
  app.openapi(getBriefingRoute, async (c) => {
    const db = c.get("db");
    const user = c.get("user");

    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const briefingPayload = await buildDashboardBriefingPayload({
      db,
      env: c.env,
      userId: user.id,
    });

    return c.json({ data: { text: briefingPayload.text } }, 200);
  });
}
