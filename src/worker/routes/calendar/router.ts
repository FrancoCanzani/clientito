import { Hono } from "hono";
import { requireAuth } from "../../middleware/auth";
import type { AppRouteEnv } from "../types";
import { registerGetCalendarEvents } from "./get-events";
import { registerPostApproveProposed } from "./post-approve";
import { registerPostDismissProposed } from "./post-dismiss";
import { registerPatchProposed } from "./patch-proposed";

const calendarRoutes = new Hono<AppRouteEnv>();

calendarRoutes.use("*", requireAuth);
registerGetCalendarEvents(calendarRoutes);
registerPostApproveProposed(calendarRoutes);
registerPostDismissProposed(calendarRoutes);
registerPatchProposed(calendarRoutes);

export default calendarRoutes;
