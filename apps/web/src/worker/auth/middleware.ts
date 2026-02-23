import { createMiddleware } from "hono/factory";
import { createDb } from "../db/client";
import { createAuth } from "../../../auth";
import {
  ensureAppUser,
  ensureDefaultOrganization,
  loadAppAuthUser,
  type AppAuthUser,
} from "./user";
import { type Context, type Next } from "hono";

export type AuthUser = AppAuthUser;

type AuthEnv = {
  Bindings: Env;
  Variables: {
    user: AuthUser | null;
    db: ReturnType<typeof createDb>;
  };
};

export const authMiddleware = createMiddleware<AuthEnv>(async (c, next) => {
  const db = createDb(c.env.DB);
  c.set("db", db);

  const auth = createAuth(c.env);
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });
  if (!session?.user) {
    c.set("user", null);
    await next();
    return;
  }

  await ensureAppUser(db, {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name ?? null,
  });

  await ensureDefaultOrganization(db, {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name ?? null,
  });

  const user = await loadAppAuthUser(db, session.user.id);
  if (!user) {
    c.set("user", null);
    await next();
    return;
  }
  c.set("user", user);

  await next();
});

export async function requireAuth(c: Context<AuthEnv>, next: Next) {
  const user = c.get("user");

  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  await next();
}

/** Middleware that injects db but doesn't require auth */
export const dbMiddleware = createMiddleware<{ Bindings: Env; Variables: { db: ReturnType<typeof createDb> } }>(
  async (c, next) => {
    c.set("db", createDb(c.env.DB));
    await next();
  }
);
