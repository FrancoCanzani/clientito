import { OpenAPIHono } from "@hono/zod-openapi";
import { requireAuth } from "../../auth/middleware";
import type { AppRouteEnv } from "../types";
import { registerGetReleases } from "./get";
import { registerPostRelease } from "./post";
import { registerPutRelease } from "./put";
import { registerDeleteRelease } from "./delete";
import { registerGenerateNotes } from "./generate-notes";

const releaseRoutes = new OpenAPIHono<AppRouteEnv>();

releaseRoutes.use("*", requireAuth);
registerGetReleases(releaseRoutes);
registerPostRelease(releaseRoutes);
registerPutRelease(releaseRoutes);
registerDeleteRelease(releaseRoutes);
registerGenerateNotes(releaseRoutes);

export default releaseRoutes;
