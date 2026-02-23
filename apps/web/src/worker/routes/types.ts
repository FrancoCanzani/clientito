import type { AuthUser } from "../auth/middleware";
import type { Database } from "../db/client";

export type AppRouteEnv = {
  Bindings: Env;
  Variables: {
    user: AuthUser;
    db: Database;
  };
};
