import { OpenAPIHono } from "@hono/zod-openapi";
import { requireAuth } from "../../auth/middleware";
import type { AppRouteEnv } from "../types";
import { registerGetEmailAttachment } from "./attachment";
import { registerGetEmailDetail } from "./detail";
import { registerGetEmailList } from "./list";
import { registerGetEmailsByPerson } from "./person";
import { registerGetEmailSearch } from "./search";
import { registerPostSendEmail } from "./send";
import { registerGetEmailThread } from "./thread";

const emailsRoutes = new OpenAPIHono<AppRouteEnv>();

emailsRoutes.use("*", requireAuth);
registerGetEmailList(emailsRoutes);
registerGetEmailSearch(emailsRoutes);
registerGetEmailDetail(emailsRoutes);
registerGetEmailAttachment(emailsRoutes);
registerGetEmailThread(emailsRoutes);
registerGetEmailsByPerson(emailsRoutes);
registerPostSendEmail(emailsRoutes);

export default emailsRoutes;
