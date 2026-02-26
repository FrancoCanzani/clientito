import { OpenAPIHono } from "@hono/zod-openapi";
import { requireAuth } from "../../auth/middleware";
import type { AppRouteEnv } from "../types";
import { registerGetEmailSearch } from "./get";
import { registerPostMarkAsCustomer } from "./post";

const emailsRoutes = new OpenAPIHono<AppRouteEnv>();

emailsRoutes.use("*", requireAuth);
registerGetEmailSearch(emailsRoutes);
registerPostMarkAsCustomer(emailsRoutes);

export default emailsRoutes;
