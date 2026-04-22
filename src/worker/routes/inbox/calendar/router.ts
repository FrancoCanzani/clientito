import { Hono } from "hono";
import type { AppRouteEnv } from "../../types";
import { registerPreviewCalendarInvite } from "./preview";
import { registerRespondCalendarInvite } from "./respond";

const calendarRoutes = new Hono<AppRouteEnv>();

registerPreviewCalendarInvite(calendarRoutes);
registerRespondCalendarInvite(calendarRoutes);

export default calendarRoutes;
