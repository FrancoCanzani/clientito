import { Hono } from "hono";
import { requireAuth } from "../../middleware/auth";
import type { AppRouteEnv } from "../types";
import { registerDeleteTasks } from "./delete";
import { registerGetTasks } from "./get";
import { registerPatchTasks } from "./patch";
import { registerPostTasks } from "./post";

const tasksRoutes = new Hono<AppRouteEnv>();

tasksRoutes.use("*", requireAuth);
registerGetTasks(tasksRoutes);
registerPostTasks(tasksRoutes);
registerPatchTasks(tasksRoutes);
registerDeleteTasks(tasksRoutes);

export default tasksRoutes;
