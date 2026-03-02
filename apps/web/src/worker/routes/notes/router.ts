import { OpenAPIHono } from "@hono/zod-openapi";
import { requireAuth } from "../../auth/middleware";
import type { AppRouteEnv } from "../types";
import { registerDeleteNotes } from "./delete";
import { registerPostNotes } from "./post";

const notesRoutes = new OpenAPIHono<AppRouteEnv>();

notesRoutes.use("*", requireAuth);
registerPostNotes(notesRoutes);
registerDeleteNotes(notesRoutes);

export default notesRoutes;
