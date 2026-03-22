import { Hono } from "hono";
import { requireAuth } from "../../../middleware/auth";
import type { AppRouteEnv } from "../../types";
import { registerContactSearch } from "./contacts";

const searchRoutes = new Hono<AppRouteEnv>();

searchRoutes.use("*", requireAuth);
registerContactSearch(searchRoutes);

export default searchRoutes;
