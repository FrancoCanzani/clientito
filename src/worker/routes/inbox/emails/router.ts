import { Hono } from "hono";
import type { AppRouteEnv } from "../../types";
import { registerDeleteBatch } from "./delete-batch";
import { registerDeleteEmail } from "./delete";
import { registerGetAttachment } from "./get-attachment";
import { registerGetScheduledEmails } from "./get-scheduled";
import { registerGetEmailThread } from "./get-thread";
import { registerPatchEmail } from "./patch";
import { registerBatchPatchEmails } from "./patch-batch";
import { registerPatchThread } from "./patch-thread";
import { registerPostEmail } from "./post";
import { registerUploadAttachments } from "./post-attachments";

const emailsRoutes = new Hono<AppRouteEnv>();

registerBatchPatchEmails(emailsRoutes);
registerDeleteBatch(emailsRoutes);
registerGetAttachment(emailsRoutes);
registerUploadAttachments(emailsRoutes);
registerGetScheduledEmails(emailsRoutes);
registerGetEmailThread(emailsRoutes);
registerPatchThread(emailsRoutes);
registerPatchEmail(emailsRoutes);
registerDeleteEmail(emailsRoutes);
registerPostEmail(emailsRoutes);

export default emailsRoutes;
