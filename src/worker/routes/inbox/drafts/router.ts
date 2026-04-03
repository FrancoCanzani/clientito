import { Hono } from "hono";
import { requireAuth } from "../../../middleware/auth";
import type { AppRouteEnv } from "../../types";
import { registerDeleteDrafts } from "./delete";
import { registerGetDrafts } from "./get";
import { registerPostDrafts } from "./post";

const draftsRoutes = new Hono<AppRouteEnv>();

draftsRoutes.use("*", requireAuth);
registerGetDrafts(draftsRoutes);
registerPostDrafts(draftsRoutes);
registerDeleteDrafts(draftsRoutes);

export default draftsRoutes;
