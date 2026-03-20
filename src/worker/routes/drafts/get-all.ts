import { desc, eq } from "drizzle-orm";
import type { Hono } from "hono";
import { drafts } from "../../db/schema";
import type { AppRouteEnv } from "../types";

export function registerGetAllDrafts(api: Hono<AppRouteEnv>) {
  api.get("/", async (c) => {
    const db = c.get("db");
    const user = c.get("user")!;

    const rows = await db
      .select()
      .from(drafts)
      .where(eq(drafts.userId, user.id))
      .orderBy(desc(drafts.updatedAt));

    return c.json({ data: rows }, 200);
  });
}
