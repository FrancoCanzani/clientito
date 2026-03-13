import { Hono } from "hono";
import { requireAuth } from "../../middleware/auth";
import type { AppRouteEnv } from "../types";
import { registerGetBriefing, registerPostBriefingStream } from "./get-briefing";
import { registerGetPersonContext } from "./get-person-context";
import { registerPostDraftReply } from "./post-draft-reply";
import { registerPostExecuteSuggestion, registerPostDismissSuggestion } from "./post-execute-suggestion";
import { registerPostSuggestActions } from "./post-suggest-actions";
import { registerPostSummarizeEmail } from "./post-summarize-email";

const aiRoutes = new Hono<AppRouteEnv>();

aiRoutes.use("*", requireAuth);
registerGetBriefing(aiRoutes);
registerPostBriefingStream(aiRoutes);
registerGetPersonContext(aiRoutes);
registerPostDraftReply(aiRoutes);
registerPostSummarizeEmail(aiRoutes);
registerPostSuggestActions(aiRoutes);
registerPostExecuteSuggestion(aiRoutes);
registerPostDismissSuggestion(aiRoutes);

export default aiRoutes;
