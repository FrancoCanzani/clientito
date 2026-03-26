import { Hono } from "hono";
import { requireAuth } from "../../middleware/auth";
import type { AppRouteEnv } from "../types";
import { registerDeleteAccount } from "./delete";
import { registerDeleteConnectedAccount } from "./delete-connected-account";
import { registerGetSettings } from "./get";
import { registerPatchMailbox } from "./patch-mailbox";
import { registerSyncSettings } from "./sync";

const settingsRoutes = new Hono<AppRouteEnv>();

settingsRoutes.use("*", requireAuth);
registerDeleteAccount(settingsRoutes);
registerDeleteConnectedAccount(settingsRoutes);
registerGetSettings(settingsRoutes);
registerPatchMailbox(settingsRoutes);
registerSyncSettings(settingsRoutes);

export default settingsRoutes;
