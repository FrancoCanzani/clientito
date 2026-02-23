import { Hono } from "hono";
import type { AppRouteEnv } from "../types";
import { getSdkConfigByProjectId } from "./get";
import { updateSdkConfigByProjectId } from "./put";

const sdkConfigRoutes = new Hono<AppRouteEnv>();

sdkConfigRoutes.get("/:pid", getSdkConfigByProjectId);
sdkConfigRoutes.put("/:pid", updateSdkConfigByProjectId);

export default sdkConfigRoutes;
