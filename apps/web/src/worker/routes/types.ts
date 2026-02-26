import type { createAuth } from "../../../auth";
import type { Database } from "../db/client";

type BetterAuthSession = ReturnType<typeof createAuth>["$Infer"]["Session"];

export type AuthUser = BetterAuthSession["user"];
export type AuthSession = BetterAuthSession["session"];

export type AppVariables = {
  user: AuthUser | null;
  session: AuthSession | null;
  db: Database;
};

export type AppRouteEnv = {
  Bindings: Env;
  Variables: AppVariables;
};
