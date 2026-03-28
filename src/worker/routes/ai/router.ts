import { Hono } from "hono";
import { requireAuth } from "../../middleware/auth";
import type { AppRouteEnv } from "../types";
import { registerGetBriefing, registerPostBriefingStream } from "./get-briefing";
import { registerPostBriefingDecision } from "./post-briefing-decision";
import { registerPostDraftReply } from "./post-draft-reply";
import { registerPostDraftReplies } from "./post-draft-replies";
import { registerPostSummarizeEmail } from "./post-summarize-email";

const aiRoutes = new Hono<AppRouteEnv>();

aiRoutes.use("*", requireAuth);
registerGetBriefing(aiRoutes);
registerPostBriefingStream(aiRoutes);
registerPostBriefingDecision(aiRoutes);
registerPostDraftReply(aiRoutes);
registerPostDraftReplies(aiRoutes);
registerPostSummarizeEmail(aiRoutes);

export default aiRoutes;
