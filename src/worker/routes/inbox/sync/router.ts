import { Hono } from "hono";
import { requireAuth } from "../../../middleware/auth";
import type { AppRouteEnv } from "../../types";
import { registerPullSync } from "./pull";

const syncRoutes = new Hono<AppRouteEnv>();

syncRoutes.use("*", requireAuth);
registerPullSync(syncRoutes);

export default syncRoutes;
