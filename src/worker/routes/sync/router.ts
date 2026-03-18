import { Hono } from "hono";
import { requireAuth } from "../../middleware/auth";
import type { AppRouteEnv } from "../types";
import { registerGetSync } from "./get";
import { registerPostSync } from "./post";

const syncRoutes = new Hono<AppRouteEnv>();

syncRoutes.use("*", requireAuth);
registerGetSync(syncRoutes);
registerPostSync(syncRoutes);

export default syncRoutes;
