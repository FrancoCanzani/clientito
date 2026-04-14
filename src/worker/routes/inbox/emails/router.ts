import { Hono } from "hono";
import { requireAuth } from "../../../middleware/auth";
import type { AppRouteEnv } from "../../types";
import { registerGetAttachment } from "./get-attachment";
import { registerGetScheduledEmails } from "./get-scheduled";
import { registerPatchEmail } from "./patch";
import { registerBatchPatchEmails } from "./patch-batch";
import { registerPostEmail } from "./post";
import { registerUploadAttachments } from "./post-attachments";

const emailsRoutes = new Hono<AppRouteEnv>();

emailsRoutes.use("*", requireAuth);
registerBatchPatchEmails(emailsRoutes);
registerGetAttachment(emailsRoutes);
registerUploadAttachments(emailsRoutes);
registerGetScheduledEmails(emailsRoutes);
registerPatchEmail(emailsRoutes);
registerPostEmail(emailsRoutes);

export default emailsRoutes;
