import { Hono } from "hono";
import { requireAuth } from "../../../middleware/auth";
import type { AppRouteEnv } from "../../types";
import { registerContactSearch } from "./get-contacts";
import { registerEmailSearch } from "./get-emails";
import { registerSearchSuggestions } from "./get-suggestions";

const searchRoutes = new Hono<AppRouteEnv>();

searchRoutes.use("*", requireAuth);
registerContactSearch(searchRoutes);
registerEmailSearch(searchRoutes);
registerSearchSuggestions(searchRoutes);

export default searchRoutes;
