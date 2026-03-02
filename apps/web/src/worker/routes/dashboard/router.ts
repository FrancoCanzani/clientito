import { OpenAPIHono } from "@hono/zod-openapi";
import { requireAuth } from "../../auth/middleware";
import type { AppRouteEnv } from "../types";
import { registerGetBriefing } from "./briefing";
import { registerPostBriefingStream } from "./briefing-stream";
import { registerGetPersonContext } from "./person-context";

const dashboardRoutes = new OpenAPIHono<AppRouteEnv>();

dashboardRoutes.use("*", requireAuth);
registerGetBriefing(dashboardRoutes);
registerPostBriefingStream(dashboardRoutes);
registerGetPersonContext(dashboardRoutes);

export default dashboardRoutes;
