import { Hono } from "hono";
import { requireAuth } from "../../middleware/auth";
import type { AppRouteEnv } from "../types";
import { registerPostGrammarCheck } from "./post-grammar-check";
import { registerPostReplyDraft } from "./post-reply-draft";
import { registerPostRewrite } from "./post-rewrite";
import { registerPostThreadSummary } from "./post-thread-summary";

const aiRoutes = new Hono<AppRouteEnv>();

aiRoutes.use("*", requireAuth);
registerPostGrammarCheck(aiRoutes);
registerPostRewrite(aiRoutes);
registerPostThreadSummary(aiRoutes);
registerPostReplyDraft(aiRoutes);

export default aiRoutes;
