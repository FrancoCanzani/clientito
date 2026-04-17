import { Hono } from "hono";
import type { AppRouteEnv } from "../../types";
import { registerDeleteEmail } from "./delete";
import { registerGetAttachment } from "./get-attachment";
import { registerGetScheduledEmails } from "./get-scheduled";
import { registerPatchEmail } from "./patch";
import { registerBatchPatchEmails } from "./patch-batch";
import { registerPostEmail } from "./post";
import { registerUploadAttachments } from "./post-attachments";

const emailsRoutes = new Hono<AppRouteEnv>();

registerBatchPatchEmails(emailsRoutes);
registerGetAttachment(emailsRoutes);
registerUploadAttachments(emailsRoutes);
registerGetScheduledEmails(emailsRoutes);
registerPatchEmail(emailsRoutes);
registerDeleteEmail(emailsRoutes);
registerPostEmail(emailsRoutes);

export default emailsRoutes;
