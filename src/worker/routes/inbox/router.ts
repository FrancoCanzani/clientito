import { Hono } from "hono";
import { requireAuth } from "../../middleware/auth";
import type { AppRouteEnv } from "../types";
import calendarRoutes from "./calendar/router";
import emailsRoutes from "./emails/router";
import gatekeeperRoutes from "./gatekeeper/router";
import labelsRoutes from "./labels/router";
import { registerInboxSearch } from "./search";
import { registerInboxSyncDelta } from "./sync-delta";
import { registerInboxUnreadCount } from "./unread-count";
import subscriptionsRoutes from "./subscriptions/router";
import viewRoutes from "./view";

const inboxRoutes = new Hono<AppRouteEnv>();

inboxRoutes.use("*", requireAuth);

inboxRoutes.route("/emails", emailsRoutes);
inboxRoutes.route("/labels", labelsRoutes);
inboxRoutes.route("/subscriptions", subscriptionsRoutes);
inboxRoutes.route("/calendar", calendarRoutes);
inboxRoutes.route("/gatekeeper", gatekeeperRoutes);

const viewSubRoutes = new Hono<AppRouteEnv>();
viewRoutes(viewSubRoutes);
inboxRoutes.route("/view", viewSubRoutes);

registerInboxSearch(inboxRoutes);
registerInboxUnreadCount(inboxRoutes);
registerInboxSyncDelta(inboxRoutes);

export default inboxRoutes;
