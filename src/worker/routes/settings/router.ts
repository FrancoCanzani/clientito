import { Hono } from "hono";
import { requireAuth } from "../../middleware/auth";
import type { AppRouteEnv } from "../types";
import { registerDeleteAccount } from "./delete";
import { registerSignatureRoutes } from "./signature";

const settingsRoutes = new Hono<AppRouteEnv>();

settingsRoutes.use("*", requireAuth);
registerDeleteAccount(settingsRoutes);
registerSignatureRoutes(settingsRoutes);

export default settingsRoutes;
