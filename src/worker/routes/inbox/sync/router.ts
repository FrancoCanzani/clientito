import { Hono } from "hono";
import type { AppRouteEnv } from "../../types";
import { registerPullSync } from "./pull";

const syncRoutes = new Hono<AppRouteEnv>();

registerPullSync(syncRoutes);

export default syncRoutes;
