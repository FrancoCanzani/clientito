import { OpenAPIHono } from "@hono/zod-openapi";
import { requireAuth } from "../../auth/middleware";
import type { AppRouteEnv } from "../types";
import { registerGetEmailAnalysis } from "./analyze";
import { registerGetEmailAttachment } from "./attachment";
import { registerGetEmailDetail } from "./detail";
import { registerGetEmailList } from "./list";
import { registerGetEmailSearch } from "./search";
import { registerPostMarkAsCustomer } from "./mark-customer";
import { registerGetActionableEmails } from "./actionable";

const emailsRoutes = new OpenAPIHono<AppRouteEnv>();

emailsRoutes.use("*", requireAuth);
registerGetEmailList(emailsRoutes);
registerGetEmailSearch(emailsRoutes);
registerGetEmailDetail(emailsRoutes);
registerGetEmailAttachment(emailsRoutes);
registerPostMarkAsCustomer(emailsRoutes);
registerGetEmailAnalysis(emailsRoutes);
registerGetActionableEmails(emailsRoutes);

export default emailsRoutes;
