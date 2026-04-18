import { Hono } from "hono";
import { requireAuth } from "../../middleware/auth";
import type { AppRouteEnv } from "../types";
import { registerPostClassifyThread } from "./post-classify";
import { registerPostGrammarCheck } from "./post-grammar-check";
import { registerPostRewrite } from "./post-rewrite";

const aiRoutes = new Hono<AppRouteEnv>();

aiRoutes.use("*", requireAuth);
registerPostClassifyThread(aiRoutes);
registerPostGrammarCheck(aiRoutes);
registerPostRewrite(aiRoutes);

export default aiRoutes;
