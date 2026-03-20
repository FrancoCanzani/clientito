import { Hono } from "hono";
import { requireAuth } from "../../middleware/auth";
import type { AppRouteEnv } from "../types";
import { registerDeleteDraft } from "./delete";
import { registerGetAllDrafts } from "./get-all";
import { registerGetDraft } from "./get";
import { registerUpsertDraft } from "./upsert";

const draftsRoutes = new Hono<AppRouteEnv>();

draftsRoutes.use("*", requireAuth);
registerGetAllDrafts(draftsRoutes);
registerGetDraft(draftsRoutes);
registerUpsertDraft(draftsRoutes);
registerDeleteDraft(draftsRoutes);

export default draftsRoutes;
