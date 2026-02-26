import { createMiddleware } from "hono/factory";
import { type Context, type Next } from "hono";
import { createAuth } from "../../../auth";
import { createDb } from "../db/client";
import type { AppRouteEnv } from "../routes/types";

export const authMiddleware = createMiddleware<AppRouteEnv>(async (c, next) => {
  c.set("db", createDb(c.env.DB));

  const auth = createAuth(c.env);
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  if (!session?.user) {
    c.set("user", null);
    c.set("session", null);
    await next();
    return;
  }

  c.set("user", session.user);
  c.set("session", session.session);

  await next();
});

export async function requireAuth(c: Context<AppRouteEnv>, next: Next) {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  await next();
}
