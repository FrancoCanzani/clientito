import { Hono } from "hono";
import { requireAuth } from "../../middleware/auth";
import type { AppRouteEnv } from "../types";
import { registerGetBriefing, registerPostBriefingStream } from "./get-briefing";
import { registerPostDraftReply } from "./post-draft-reply";
import { registerPostSummarizeEmail } from "./post-summarize-email";

const aiRoutes = new Hono<AppRouteEnv>();

aiRoutes.use("*", requireAuth);
registerGetBriefing(aiRoutes);
registerPostBriefingStream(aiRoutes);
registerPostDraftReply(aiRoutes);
registerPostSummarizeEmail(aiRoutes);

export default aiRoutes;
