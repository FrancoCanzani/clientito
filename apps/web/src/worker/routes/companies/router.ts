import { OpenAPIHono } from "@hono/zod-openapi";
import { requireAuth } from "../../auth/middleware";
import type { AppRouteEnv } from "../types";
import { registerGetCompanies, registerGetCompanyById } from "./get";
import { registerPatchCompanies } from "./patch";

const companiesRoutes = new OpenAPIHono<AppRouteEnv>();

companiesRoutes.use("*", requireAuth);
registerGetCompanies(companiesRoutes);
registerGetCompanyById(companiesRoutes);
registerPatchCompanies(companiesRoutes);

export default companiesRoutes;
