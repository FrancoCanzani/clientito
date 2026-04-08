import { Hono } from "hono";
import { requireAuth } from "../../middleware/auth";
import type { AppRouteEnv } from "../types";
import { registerPostGrammarCheck } from "./post-grammar-check";

const aiRoutes = new Hono<AppRouteEnv>();

aiRoutes.use("*", requireAuth);
registerPostGrammarCheck(aiRoutes);

export default aiRoutes;
