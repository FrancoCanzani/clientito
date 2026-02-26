import { OpenAPIHono } from "@hono/zod-openapi";
import { requireAuth } from "../../auth/middleware";
import type { AppRouteEnv } from "../types";
import { registerPostSyncIncremental } from "./incremental";
import { registerPostSyncStart } from "./start";
import { registerGetSyncStatus } from "./status";

const syncRoutes = new OpenAPIHono<AppRouteEnv>();

syncRoutes.use("*", requireAuth);
registerGetSyncStatus(syncRoutes);
registerPostSyncStart(syncRoutes);
registerPostSyncIncremental(syncRoutes);

export default syncRoutes;
