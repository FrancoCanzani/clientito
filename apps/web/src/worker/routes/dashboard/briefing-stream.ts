import type { Hono } from "hono";
import type { AppRouteEnv } from "../types";
import { buildDashboardBriefingPayload } from "./briefing-content";

export function registerPostBriefingStream(app: Hono<AppRouteEnv>) {
  app.post("/briefing/stream", async (c) => {
    const db = c.get("db");
    const user = c.get("user");

    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const briefingPayload = await buildDashboardBriefingPayload({
      db,
      env: c.env,
      userId: user.id,
    });

    return new Response(briefingPayload.text, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  });
}
