import { OpenAPIHono } from "@hono/zod-openapi";
import { requireAuth } from "../../auth/middleware";
import type { AppRouteEnv } from "../types";
import { registerGetProjects } from "./get";
import { registerPostProject } from "./post";

const projectRoutes = new OpenAPIHono<AppRouteEnv>();

projectRoutes.use("*", requireAuth);
registerGetProjects(projectRoutes);
registerPostProject(projectRoutes);

export default projectRoutes;
