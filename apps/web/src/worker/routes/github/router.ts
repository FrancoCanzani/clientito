import { OpenAPIHono } from "@hono/zod-openapi";
import { requireAuth } from "../../auth/middleware";
import type { AppRouteEnv } from "../types";
import { registerGithubConnections } from "./connections";
import { registerGetPulls } from "./pulls";

const githubRoutes = new OpenAPIHono<AppRouteEnv>();

githubRoutes.use("*", requireAuth);
registerGithubConnections(githubRoutes);
registerGetPulls(githubRoutes);

export default githubRoutes;
