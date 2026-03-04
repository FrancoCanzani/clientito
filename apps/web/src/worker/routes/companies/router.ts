import { Hono } from "hono";
import { requireAuth } from "../../middleware/auth";
import type { AppRouteEnv } from "../types";
import { registerGetCompanies, registerGetCompanyById } from "./get";
import { registerPatchCompanies } from "./patch";

const companiesRoutes = new Hono<AppRouteEnv>();

companiesRoutes.use("*", requireAuth);
registerGetCompanies(companiesRoutes);
registerGetCompanyById(companiesRoutes);
registerPatchCompanies(companiesRoutes);

export default companiesRoutes;
