import { Hono } from "hono";
import type { AppRouteEnv } from "../types";
import { getReleaseById, getReleases } from "./get";
import { createRelease, publishRelease } from "./post";
import { updateReleaseById } from "./put";
import { deleteReleaseById } from "./delete";

const releaseRoutes = new Hono<AppRouteEnv>();

releaseRoutes.get("/", getReleases);
releaseRoutes.post("/", createRelease);
releaseRoutes.get("/:rid", getReleaseById);
releaseRoutes.put("/:rid", updateReleaseById);
releaseRoutes.post("/:rid/publish", publishRelease);
releaseRoutes.delete("/:rid", deleteReleaseById);

export default releaseRoutes;
