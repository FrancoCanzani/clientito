import { OpenAPIHono } from "@hono/zod-openapi";
import { requireAuth } from "../../auth/middleware";
import type { AppRouteEnv } from "../types";
import { registerPostClassify } from "./run";

const classifyRoutes = new OpenAPIHono<AppRouteEnv>();

classifyRoutes.use("*", requireAuth);
registerPostClassify(classifyRoutes);

export default classifyRoutes;
