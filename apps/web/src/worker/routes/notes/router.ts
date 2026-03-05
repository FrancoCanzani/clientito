import { Hono } from "hono";
import { requireAuth } from "../../middleware/auth";
import type { AppRouteEnv } from "../types";
import { registerDeleteNotes } from "./delete";
import { registerGetNoteById } from "./get-by-id";
import { registerGetNoteImage } from "./get-image";
import { registerGetNotes } from "./get";
import { registerPatchNotes } from "./patch";
import { registerPostNoteImage } from "./post-image";
import { registerPostNotes } from "./post";

const notesRoutes = new Hono<AppRouteEnv>();

notesRoutes.use("*", requireAuth);
registerGetNotes(notesRoutes);
registerGetNoteImage(notesRoutes);
registerPostNoteImage(notesRoutes);
registerGetNoteById(notesRoutes);
registerPostNotes(notesRoutes);
registerPatchNotes(notesRoutes);
registerDeleteNotes(notesRoutes);

export default notesRoutes;
