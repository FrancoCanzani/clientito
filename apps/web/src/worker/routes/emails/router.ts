import { Hono } from "hono";
import { requireAuth } from "../../middleware/auth";
import type { AppRouteEnv } from "../types";
import { registerGetAllEmails } from "./get-all";
import { registerGetAttachment } from "./get-attachment";
import { registerGetEmail } from "./get";
import { registerPatchEmail } from "./patch";
import { registerPostEmail } from "./post";
import { registerGetPersonEmails } from "./get-person";
import { registerSearchEmails } from "./search";
import { registerGetEmailThread } from "./get-thread";

const emailsRoutes = new Hono<AppRouteEnv>();

emailsRoutes.use("*", requireAuth);
registerGetAllEmails(emailsRoutes);
registerSearchEmails(emailsRoutes);
registerGetEmailThread(emailsRoutes);
registerGetPersonEmails(emailsRoutes);
registerGetAttachment(emailsRoutes);
registerGetEmail(emailsRoutes);
registerPatchEmail(emailsRoutes);
registerPostEmail(emailsRoutes);

export default emailsRoutes;
