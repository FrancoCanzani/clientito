import { type Context, type Next } from "hono";
import { HTTPException } from "hono/http-exception";
import { createMiddleware } from "hono/factory";
import { eq } from "drizzle-orm";
import { auth } from "../../../auth";
import { user as authUser } from "../db/auth-schema";
import type { AppRouteEnv } from "../routes/types";
import { createDb } from "../db/client";

export const authMiddleware = createMiddleware<AppRouteEnv>(async (c, next) => {
  c.set("db", createDb(c.env.DB));

  const pathname = new URL(c.req.raw.url).pathname;
  if (pathname.startsWith("/api/auth/")) {
    c.set("user", null);
    c.set("session", null);
    await next();
    return;
  }

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

  const db = c.get("db");
  const persistedUser = await db.query.user.findFirst({
    where: eq(authUser.id, user.id),
    columns: { id: true },
  });

  if (!persistedUser) {
    c.set("user", null);
    c.set("session", null);
    return c.json({ error: "Unauthorized. Please sign in again." }, 401);
  }

  await next();
}

export function getUser(c: Context<AppRouteEnv>) {
  const user = c.get("user");
  if (!user) {
    throw new HTTPException(401, { message: "Unauthorized" });
  }
  return user;
}