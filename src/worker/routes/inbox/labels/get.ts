import { eq } from "drizzle-orm";
import type { Hono } from "hono";
import { labels } from "../../../db/schema";
import type { AppRouteEnv } from "../../types";

export function registerGetLabels(api: Hono<AppRouteEnv>) {
  api.get("/", async (c) => {
    const db = c.get("db");
    const user = c.get("user")!;

    const rows = await db
      .select()
      .from(labels)
      .where(eq(labels.userId, user.id));

    return c.json({ data: rows }, 200);
  });
}
