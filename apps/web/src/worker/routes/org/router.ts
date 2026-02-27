import { OpenAPIHono } from "@hono/zod-openapi";
import { requireAuth } from "../../auth/middleware";
import type { AppRouteEnv } from "../types";
import { registerGetOrganizations } from "./list";
import { registerPatchOrganization } from "./update";
import { registerPostOrganization } from "./create";

const orgRoutes = new OpenAPIHono<AppRouteEnv>();

orgRoutes.use("*", requireAuth);
registerGetOrganizations(orgRoutes);
registerPostOrganization(orgRoutes);
registerPatchOrganization(orgRoutes);

export default orgRoutes;
