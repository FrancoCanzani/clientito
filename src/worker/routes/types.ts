import type { auth } from "../../../auth";
import type { Database } from "../db/client";

type BetterAuthSession = ReturnType<typeof auth>["$Infer"]["Session"];

type AuthSession = BetterAuthSession["session"];

export type AppVariables = {
  user: BetterAuthSession["user"] | null;
  session: AuthSession | null;
  db: Database;
};

export type AppRouteEnv = {
  Bindings: Env;
  Variables: AppVariables;
};
