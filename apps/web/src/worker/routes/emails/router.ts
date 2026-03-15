import { Hono } from "hono";
import { requireAuth } from "../../middleware/auth";
import type { AppRouteEnv } from "../types";
import { registerBatchPatchEmails } from "./batch-patch";
import { registerGetEmail } from "./get";
import { registerGetAllEmails } from "./get-all";
import { registerGetAttachment } from "./get-attachment";
import { registerGetEmailThread } from "./get-thread";
import { registerPatchEmail } from "./patch";
import { registerUploadAttachments } from "./attachments";
import { registerPostEmail } from "./post";
import { registerSearchEmails } from "./search";

const emailsRoutes = new Hono<AppRouteEnv>();

emailsRoutes.use("*", requireAuth);
registerGetAllEmails(emailsRoutes);
registerSearchEmails(emailsRoutes);
registerGetEmailThread(emailsRoutes);
registerBatchPatchEmails(emailsRoutes);
registerGetAttachment(emailsRoutes);
registerUploadAttachments(emailsRoutes);
registerGetEmail(emailsRoutes);
registerPatchEmail(emailsRoutes);
registerPostEmail(emailsRoutes);

export default emailsRoutes;
