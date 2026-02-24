import { createMiddleware } from "hono/factory";
import { type Context, type Env as HonoEnv, type Next } from "hono";
import { createAuth } from "../../../auth";
import { createDb, type Database } from "../db/client";

export type AuthUser = {
  id: string;
  email: string;
  name: string | null;
};

type AuthEnv = HonoEnv & {
  Variables: {
    user: AuthUser | null;
    db: Database;
  };
};

export const authMiddleware = createMiddleware<AuthEnv>(async (c, next) => {
  const workerEnv = c.env as Env;
  c.set("db", createDb(workerEnv.DB));

  const auth = createAuth(workerEnv);
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  if (!session?.user) {
    c.set("user", null);
    await next();
    return;
  }

  c.set("user", {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name ?? null,
  });

  await next();
});

export async function requireAuth(c: Context<AuthEnv>, next: Next) {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  await next();
}
