import { Hono } from "hono";
import { requireAuth } from "../../middleware/auth";
import type { AppRouteEnv } from "../types";
import emailsRoutes from "./emails/router";
import labelsRoutes from "./labels/router";
import { registerInboxSearch } from "./search";
import subscriptionsRoutes from "./subscriptions/router";
import viewRoutes from "./view";

const inboxRoutes = new Hono<AppRouteEnv>();

inboxRoutes.use("*", requireAuth);

inboxRoutes.route("/emails", emailsRoutes);
inboxRoutes.route("/labels", labelsRoutes);
inboxRoutes.route("/subscriptions", subscriptionsRoutes);

const viewSubRoutes = new Hono<AppRouteEnv>();
viewRoutes(viewSubRoutes);
inboxRoutes.route("/view", viewSubRoutes);

registerInboxSearch(inboxRoutes);

export default inboxRoutes;
