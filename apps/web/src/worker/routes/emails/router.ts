import { OpenAPIHono } from "@hono/zod-openapi";
import { requireAuth } from "../../middleware/auth";
import type { AppRouteEnv } from "../types";
import { registerGetAllEmails } from "./get-all";
import { registerGetAttachment } from "./get-attachment";
import { registerGetEmail } from "./get";
import { registerPatchEmail } from "./patch";
import { registerPostEmail } from "./post";

const emailsRoutes = new OpenAPIHono<AppRouteEnv>();

emailsRoutes.use("*", requireAuth);
registerGetAllEmails(emailsRoutes);
registerGetAttachment(emailsRoutes);
registerGetEmail(emailsRoutes);
registerPatchEmail(emailsRoutes);
registerPostEmail(emailsRoutes);

export default emailsRoutes;
