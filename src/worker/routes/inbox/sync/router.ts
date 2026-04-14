import { Hono } from "hono";
import { requireAuth } from "../../../middleware/auth";
import type { AppRouteEnv } from "../../types";
import { registerGetSync } from "./get";
import { registerPostSync } from "./post";
import { registerPullSync } from "./pull";

const syncRoutes = new Hono<AppRouteEnv>();

syncRoutes.use("*", requireAuth);
registerGetSync(syncRoutes);
registerPostSync(syncRoutes);
registerPullSync(syncRoutes);

export default syncRoutes;
