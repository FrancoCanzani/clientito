import { Hono } from "hono";
import { requireAuth } from "../../../middleware/auth";
import type { AppRouteEnv } from "../../types";
import { registerGetEmail } from "./get";
import { registerGetAllEmails } from "./get-all";
import { registerGetAttachment } from "./get-attachment";
import { registerGetEmailAIDetail } from "./get-ai-detail";
import { registerGetScheduledEmails } from "./get-scheduled";
import { registerGetEmailThread } from "./get-thread";
import { registerPatchEmail } from "./patch";
import { registerBatchPatchEmails } from "./patch-batch";
import { registerPostEmail } from "./post";
import { registerUploadAttachments } from "./post-attachments";
import { registerGetIntelligenceUpdates } from "./get-intelligence-updates";

const emailsRoutes = new Hono<AppRouteEnv>();

emailsRoutes.use("*", requireAuth);
registerGetAllEmails(emailsRoutes);
registerGetEmailThread(emailsRoutes);
registerBatchPatchEmails(emailsRoutes);
registerGetAttachment(emailsRoutes);
registerUploadAttachments(emailsRoutes);
registerGetScheduledEmails(emailsRoutes);
registerGetEmailAIDetail(emailsRoutes);
registerGetIntelligenceUpdates(emailsRoutes);
registerGetEmail(emailsRoutes);
registerPatchEmail(emailsRoutes);
registerPostEmail(emailsRoutes);

export default emailsRoutes;
