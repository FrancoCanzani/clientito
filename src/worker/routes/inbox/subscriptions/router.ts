import { Hono } from "hono";
import { requireAuth } from "../../../middleware/auth";
import type { AppRouteEnv } from "../../types";
import { registerPostBulkUnsubscribe } from "./post-bulk-unsubscribe";
import { registerPostUnsubscribe } from "./post-unsubscribe";

const subscriptionsRoutes = new Hono<AppRouteEnv>();

subscriptionsRoutes.use("*", requireAuth);
registerPostUnsubscribe(subscriptionsRoutes);
registerPostBulkUnsubscribe(subscriptionsRoutes);

export default subscriptionsRoutes;
