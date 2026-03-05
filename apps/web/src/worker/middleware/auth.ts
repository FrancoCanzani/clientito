import { type Context, type Next } from "hono";
import { createMiddleware } from "hono/factory";
import { auth } from "../../../auth";
import { createDb } from "../db/client";
import type { AppRouteEnv } from "../routes/types";

export const authMiddleware = createMiddleware<AppRouteEnv>(async (c, next) => {
  c.set("db", createDb(c.env.DB));

  const authInstance = auth(c.env);
  const session = await authInstance.api.getSession({
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
