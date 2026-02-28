import { Hono } from "hono";
import { requireAuth } from "../../auth/middleware";
import type { AppRouteEnv } from "../types";
import { registerGetBriefing } from "./briefing";

const dashboardRoutes = new Hono<AppRouteEnv>();

dashboardRoutes.use("*", requireAuth);
registerGetBriefing(dashboardRoutes);

export default dashboardRoutes;
