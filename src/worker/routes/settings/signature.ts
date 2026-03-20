import type { Hono } from "hono";
import { eq } from "drizzle-orm";
import { userSettings } from "../../db/schema";
import type { AppRouteEnv } from "../types";

export function registerSignatureRoutes(api: Hono<AppRouteEnv>) {
  api.get("/signature", async (c) => {
    const db = c.get("db");
    const currentUser = c.get("user")!;

    const row = await db
      .select({ signature: userSettings.signature })
      .from(userSettings)
      .where(eq(userSettings.userId, currentUser.id))
      .get();

    return c.json({ signature: row?.signature ?? null });
  });

  api.put("/signature", async (c) => {
    const db = c.get("db");
    const currentUser = c.get("user")!;
    const body = await c.req.json<{ signature: string | null }>();

    const signature = body.signature?.trim() || null;

    await db
      .insert(userSettings)
      .values({
        userId: currentUser.id,
        signature,
        updatedAt: Date.now(),
      })
      .onConflictDoUpdate({
        target: userSettings.userId,
        set: {
          signature,
          updatedAt: Date.now(),
        },
      });

    return c.json({ signature });
  });
}
