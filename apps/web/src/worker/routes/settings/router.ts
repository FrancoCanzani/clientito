import { Hono } from "hono";
import { requireAuth } from "../../middleware/auth";
import type { AppRouteEnv } from "../types";
import { registerDeleteAccount } from "./delete";

const settingsRoutes = new Hono<AppRouteEnv>();

settingsRoutes.use("*", requireAuth);
registerDeleteAccount(settingsRoutes);

export default settingsRoutes;
