import { Hono } from "hono";
import { requireAuth } from "../../auth/middleware";
import type { AppRouteEnv } from "../types";
import { registerGetBriefing } from "./briefing";
import { registerPostBriefingStream } from "./briefing-stream";

const dashboardRoutes = new Hono<AppRouteEnv>();

dashboardRoutes.use("*", requireAuth);
registerGetBriefing(dashboardRoutes);
registerPostBriefingStream(dashboardRoutes);

export default dashboardRoutes;
