import { Hono } from "hono";
import type { AppRouteEnv } from "../../types";
import { registerGetLabels } from "./get";
import { registerCreateLabel } from "./post";
import { registerUpdateLabel } from "./patch";
import { registerDeleteLabel } from "./delete";
import { registerApplyLabel } from "./post-apply";
import { registerRemoveLabel } from "./post-remove";
import { registerSyncLabels } from "./sync";

const labelsRoutes = new Hono<AppRouteEnv>();

registerGetLabels(labelsRoutes);
registerCreateLabel(labelsRoutes);
registerUpdateLabel(labelsRoutes);
registerDeleteLabel(labelsRoutes);
registerApplyLabel(labelsRoutes);
registerRemoveLabel(labelsRoutes);
registerSyncLabels(labelsRoutes);

export default labelsRoutes;
