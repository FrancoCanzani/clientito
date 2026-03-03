import { type Context, type Next } from "hono";
import { createMiddleware } from "hono/factory";
import { auth } from "../../auth";
import { createDb } from "../db/client";
import { createTimer } from "../lib/timing";
import type { AppRouteEnv } from "../routes/types";

export const authMiddleware = createMiddleware<AppRouteEnv>(async (c, next) => {
  const timer = createTimer("auth-middleware", {
    method: c.req.method,
    path: c.req.path,
  });
  c.set("db", createDb(c.env.DB));
  timer.mark("db");

  const authInstance = auth(c.env);
  const session = await authInstance.api.getSession({
    headers: c.req.raw.headers,
  });
  timer.mark("session");

  if (!session?.user) {
    c.set("user", null);
    c.set("session", null);
    timer.end({ authenticated: false });
    await next();
    return;
  }

  c.set("user", session.user);
  c.set("session", session.session);
  timer.end({ authenticated: true, userId: session.user.id });

  await next();
});

export async function requireAuth(c: Context<AppRouteEnv>, next: Next) {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  await next();
}
