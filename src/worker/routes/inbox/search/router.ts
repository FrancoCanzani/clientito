import { Hono } from "hono";
import { requireAuth } from "../../../middleware/auth";
import type { AppRouteEnv } from "../../types";
import { registerContactSearch } from "./contacts";
import { registerEmailSearch } from "./emails";
import { registerSearchSuggestions } from "./suggestions";

const searchRoutes = new Hono<AppRouteEnv>();

searchRoutes.use("*", requireAuth);
registerContactSearch(searchRoutes);
registerEmailSearch(searchRoutes);
registerSearchSuggestions(searchRoutes);

export default searchRoutes;
