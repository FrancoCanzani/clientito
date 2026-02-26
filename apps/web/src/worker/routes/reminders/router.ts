import { OpenAPIHono } from "@hono/zod-openapi";
import { requireAuth } from "../../auth/middleware";
import type { AppRouteEnv } from "../types";
import { registerDeleteReminder } from "./delete";
import { registerGetReminders } from "./get";
import { registerPatchReminder } from "./patch";
import { registerPostReminder } from "./post";

const remindersRoutes = new OpenAPIHono<AppRouteEnv>();

remindersRoutes.use("*", requireAuth);
registerGetReminders(remindersRoutes);
registerPostReminder(remindersRoutes);
registerPatchReminder(remindersRoutes);
registerDeleteReminder(remindersRoutes);

export default remindersRoutes;
