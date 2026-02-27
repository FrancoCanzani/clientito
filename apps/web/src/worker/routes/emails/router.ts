import { OpenAPIHono } from "@hono/zod-openapi";
import { requireAuth } from "../../auth/middleware";
import type { AppRouteEnv } from "../types";
import { registerGetEmailList } from "./list";
import { registerGetEmailSearch } from "./search";
import { registerPostMarkAsCustomer } from "./mark-customer";

const emailsRoutes = new OpenAPIHono<AppRouteEnv>();

emailsRoutes.use("*", requireAuth);
registerGetEmailList(emailsRoutes);
registerGetEmailSearch(emailsRoutes);
registerPostMarkAsCustomer(emailsRoutes);

export default emailsRoutes;
