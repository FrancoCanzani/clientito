import { Hono } from "hono";
import type { AppRouteEnv } from "../../types";
import { registerCreateReminder } from "./post-create";
import { registerDismissReminder } from "./post-dismiss";

const remindersRoutes = new Hono<AppRouteEnv>();

registerCreateReminder(remindersRoutes);
registerDismissReminder(remindersRoutes);

export default remindersRoutes;
