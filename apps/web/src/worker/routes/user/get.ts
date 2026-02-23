import type { Context } from "hono";
import type { AppRouteEnv } from "../types";

export async function getCurrentUser(c: Context<AppRouteEnv>) {
  const user = c.get("user");
  return c.json({ user });
}
