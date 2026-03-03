import { OpenAPIHono } from "@hono/zod-openapi";
import { requireAuth } from "../../middleware/auth";
import type { AppRouteEnv } from "../types";
import { registerDeleteAccount } from "./delete";

const settingsRoutes = new OpenAPIHono<AppRouteEnv>();

settingsRoutes.use("*", requireAuth);
registerDeleteAccount(settingsRoutes);

export default settingsRoutes;
