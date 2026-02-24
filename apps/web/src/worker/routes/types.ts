import type { Env as HonoEnv } from "hono";
import type { AuthUser } from "../auth/middleware";
import type { Database } from "../db/client";

export type AppRouteEnv = HonoEnv & {
  Variables: {
    user: AuthUser | null;
    db: Database;
  };
};
