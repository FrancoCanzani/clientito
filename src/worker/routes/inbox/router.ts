import { Hono } from "hono";
import type { AppRouteEnv } from "../types";
import emailsRoutes from "./emails/router";
import filtersRoutes from "./filters/router";
import searchRoutes from "./search/router";
import subscriptionsRoutes from "./subscriptions/router";
import syncRoutes from "./sync/router";

const inboxRoutes = new Hono<AppRouteEnv>();

inboxRoutes.route("/emails", emailsRoutes);
inboxRoutes.route("/filters", filtersRoutes);
inboxRoutes.route("/search", searchRoutes);
inboxRoutes.route("/subscriptions", subscriptionsRoutes);
inboxRoutes.route("/sync", syncRoutes);

export default inboxRoutes;
