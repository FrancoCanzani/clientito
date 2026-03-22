import { asc, eq } from "drizzle-orm";
import type { Hono } from "hono";
import { emailFilters } from "../../../db/schema";
import type { AppRouteEnv } from "../../types";

export function registerGetFilters(app: Hono<AppRouteEnv>) {
  app.get("/", async (c) => {
    const user = c.get("user")!;

    const db = c.get("db");
    const rows = await db
      .select()
      .from(emailFilters)
      .where(eq(emailFilters.userId, user.id))
      .orderBy(asc(emailFilters.priority));

    return c.json({ data: rows });
  });
}
