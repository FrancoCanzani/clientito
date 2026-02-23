import { Hono } from "hono";
import type { AppRouteEnv } from "../types";
import { getUsageSummary } from "./get";

const usageRoutes = new Hono<AppRouteEnv>();

usageRoutes.get("/summary", getUsageSummary);

export default usageRoutes;
