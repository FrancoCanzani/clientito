import { OpenAPIHono } from "@hono/zod-openapi";
import { requireAuth } from "../../auth/middleware";
import type { AppRouteEnv } from "../types";
import { registerGetOrganizations } from "./get";
import { registerPostOrganization } from "./post";

const orgRoutes = new OpenAPIHono<AppRouteEnv>();

orgRoutes.use("*", requireAuth);
registerGetOrganizations(orgRoutes);
registerPostOrganization(orgRoutes);

export default orgRoutes;
