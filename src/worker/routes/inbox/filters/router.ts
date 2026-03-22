import { Hono } from "hono";
import { requireAuth } from "../../../middleware/auth";
import type { AppRouteEnv } from "../../types";
import { registerGetFilters } from "./get-all";
import { registerCreateFilter } from "./post-create";
import { registerUpdateFilter } from "./put-update";
import { registerDeleteFilter } from "./delete";
import { registerGenerateFilter } from "./post-generate";
import { registerTestFilter } from "./post-test";

const filtersRoutes = new Hono<AppRouteEnv>();

filtersRoutes.use("*", requireAuth);
registerGetFilters(filtersRoutes);
registerCreateFilter(filtersRoutes);
registerUpdateFilter(filtersRoutes);
registerDeleteFilter(filtersRoutes);
registerTestFilter(filtersRoutes);
registerGenerateFilter(filtersRoutes);

export default filtersRoutes;
