import { Hono } from "hono";
import { requireAuth } from "../../middleware/auth";
import type { AppRouteEnv } from "../types";
import { registerAccountSettings } from "./accounts";
import { registerDeleteAccount } from "./delete";
import { registerSyncSettings } from "./sync";

const settingsRoutes = new Hono<AppRouteEnv>();

settingsRoutes.use("*", requireAuth);
registerDeleteAccount(settingsRoutes);
registerSyncSettings(settingsRoutes);
registerAccountSettings(settingsRoutes);

export default settingsRoutes;
