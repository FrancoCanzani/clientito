import { OpenAPIHono } from "@hono/zod-openapi";
import { requireAuth } from "../../auth/middleware";
import type { AppRouteEnv } from "../types";
import { registerDeleteReminder } from "./remove";
import { registerGetReminders } from "./list";
import { registerPatchReminder } from "./update";
import { registerPostReminder } from "./create";

const remindersRoutes = new OpenAPIHono<AppRouteEnv>();

remindersRoutes.use("*", requireAuth);
registerGetReminders(remindersRoutes);
registerPostReminder(remindersRoutes);
registerPatchReminder(remindersRoutes);
registerDeleteReminder(remindersRoutes);

export default remindersRoutes;
