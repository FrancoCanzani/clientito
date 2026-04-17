import { Hono } from "hono";
import type { AppRouteEnv } from "../../types";
import { registerPostBlockSender } from "./post-block-sender";
import { registerPostBulkUnsubscribe } from "./post-bulk-unsubscribe";
import { registerPostUnsubscribe } from "./post-unsubscribe";

const subscriptionsRoutes = new Hono<AppRouteEnv>();

registerPostUnsubscribe(subscriptionsRoutes);
registerPostBulkUnsubscribe(subscriptionsRoutes);
registerPostBlockSender(subscriptionsRoutes);

export default subscriptionsRoutes;
