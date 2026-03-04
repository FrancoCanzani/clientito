import { Hono } from "hono";
import { requireAuth } from "../../middleware/auth";
import type { AppRouteEnv } from "../types";
import { registerDeleteNotes } from "./delete";
import { registerPostNotes } from "./post";

const notesRoutes = new Hono<AppRouteEnv>();

notesRoutes.use("*", requireAuth);
registerPostNotes(notesRoutes);
registerDeleteNotes(notesRoutes);

export default notesRoutes;
