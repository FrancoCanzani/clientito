import { Hono } from "hono";
import { requireAuth } from "../../middleware/auth";
import type { AppRouteEnv } from "../types";
import { registerDeleteAccount } from "./delete";
import { registerDeleteConnectedAccount } from "./delete-connected-account";
import { registerGetSettings } from "./get";
import { registerGetSyncSettings } from "./get-sync";
import { registerGoogleConnect } from "./google-connect";
import { registerPatchMailbox } from "./patch-mailbox";
import { registerPutSyncSettings } from "./put-sync";

const settingsRoutes = new Hono<AppRouteEnv>();

settingsRoutes.use("*", requireAuth);
registerDeleteAccount(settingsRoutes);
registerDeleteConnectedAccount(settingsRoutes);
registerGetSettings(settingsRoutes);
registerGetSyncSettings(settingsRoutes);
registerGoogleConnect(settingsRoutes);
registerPatchMailbox(settingsRoutes);
registerPutSyncSettings(settingsRoutes);

export default settingsRoutes;
