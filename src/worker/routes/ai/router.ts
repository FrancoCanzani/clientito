import { Hono } from "hono";
import { requireAuth } from "../../middleware/auth";
import type { AppRouteEnv } from "../types";
import { registerPostBriefingStream } from "./get-briefing";
import { registerPostDraftReply } from "./post-draft-reply";
import { registerPostDraftReplies } from "./post-draft-replies";
import { registerPostGrammarCheck } from "./post-grammar-check";
import { registerPostSummarizeEmail } from "./post-summarize-email";

const aiRoutes = new Hono<AppRouteEnv>();

aiRoutes.use("*", requireAuth);
registerPostBriefingStream(aiRoutes);
registerPostDraftReply(aiRoutes);
registerPostDraftReplies(aiRoutes);
registerPostGrammarCheck(aiRoutes);
registerPostSummarizeEmail(aiRoutes);

export default aiRoutes;
