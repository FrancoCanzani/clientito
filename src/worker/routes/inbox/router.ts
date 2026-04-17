import { Hono } from "hono";
import { requireAuth } from "../../middleware/auth";
import type { AppRouteEnv } from "../types";
import emailsRoutes from "./emails/router";
import labelsRoutes from "./labels/router";
import { registerInboxSearch } from "./search";
import subscriptionsRoutes from "./subscriptions/router";
import syncRoutes from "./sync/router";

const inboxRoutes = new Hono<AppRouteEnv>();

inboxRoutes.use("*", requireAuth);

inboxRoutes.route("/emails", emailsRoutes);
inboxRoutes.route("/labels", labelsRoutes);
inboxRoutes.route("/subscriptions", subscriptionsRoutes);
inboxRoutes.route("/sync", syncRoutes);
registerInboxSearch(inboxRoutes);

export default inboxRoutes;
