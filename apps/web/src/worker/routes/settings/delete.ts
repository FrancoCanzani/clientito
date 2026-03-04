import type { Hono } from "hono";
import { eq } from "drizzle-orm";
import { user } from "../../db/auth-schema";
import type { AppRouteEnv } from "../types";

export function registerDeleteAccount(api: Hono<AppRouteEnv>) {
  api.delete("/account", async (c) => {
    const db = c.get("db");
    const currentUser = c.get("user")!;

    await db.delete(user).where(eq(user.id, currentUser.id));

    return c.json({ data: { deleted: true } }, 200);
  });
}
