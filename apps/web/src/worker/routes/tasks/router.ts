import { OpenAPIHono } from "@hono/zod-openapi";
import { requireAuth } from "../../middleware/auth";
import type { AppRouteEnv } from "../types";
import { registerDeleteTasks } from "./delete";
import { registerGetTasks } from "./get";
import { registerPatchTasks } from "./patch";
import { registerPostTasks } from "./post";

const tasksRoutes = new OpenAPIHono<AppRouteEnv>();

tasksRoutes.use("*", requireAuth);
registerGetTasks(tasksRoutes);
registerPostTasks(tasksRoutes);
registerPatchTasks(tasksRoutes);
registerDeleteTasks(tasksRoutes);

export default tasksRoutes;
