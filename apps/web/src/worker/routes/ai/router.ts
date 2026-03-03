import { OpenAPIHono } from "@hono/zod-openapi";
import { requireAuth } from "../../middleware/auth";
import type { AppRouteEnv } from "../types";
import { registerGetBriefing, registerPostBriefingStream } from "./get-briefing";
import { registerGetPersonContext } from "./get-person-context";
import { registerPostDraftReply } from "./post-draft-reply";
import { registerPostSummarizeEmail } from "./post-summarize-email";

const aiRoutes = new OpenAPIHono<AppRouteEnv>();

aiRoutes.use("*", requireAuth);
registerGetBriefing(aiRoutes);
registerPostBriefingStream(aiRoutes);
registerGetPersonContext(aiRoutes);
registerPostDraftReply(aiRoutes);
registerPostSummarizeEmail(aiRoutes);

export default aiRoutes;
