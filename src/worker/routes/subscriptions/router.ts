import { Hono } from "hono";
import { requireAuth } from "../../middleware/auth";
import type { AppRouteEnv } from "../types";
import { registerGetSubscriptions } from "./get-all";
import { registerPostUnsubscribe } from "./post-unsubscribe";

const subscriptionsRoutes = new Hono<AppRouteEnv>();

subscriptionsRoutes.use("*", requireAuth);
registerGetSubscriptions(subscriptionsRoutes);
registerPostUnsubscribe(subscriptionsRoutes);

export default subscriptionsRoutes;
