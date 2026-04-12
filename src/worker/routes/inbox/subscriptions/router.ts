import { Hono } from "hono";
import { requireAuth } from "../../../middleware/auth";
import type { AppRouteEnv } from "../../types";
import { registerGetSubscriptions } from "./get-subscriptions";
import { registerGetSuggestions } from "./get-suggestions";
import { registerPostBulkUnsubscribe } from "./post-bulk-unsubscribe";
import { registerPostUnsubscribe } from "./post-unsubscribe";

const subscriptionsRoutes = new Hono<AppRouteEnv>();

subscriptionsRoutes.use("*", requireAuth);
registerGetSubscriptions(subscriptionsRoutes);
registerGetSuggestions(subscriptionsRoutes);
registerPostUnsubscribe(subscriptionsRoutes);
registerPostBulkUnsubscribe(subscriptionsRoutes);

export default subscriptionsRoutes;
