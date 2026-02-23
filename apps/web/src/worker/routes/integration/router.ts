import { Hono } from "hono";
import type { AppRouteEnv } from "../types";
import { getIntegrationById, getIntegrations } from "./get";
import { createIntegration, toggleIntegration } from "./post";
import { updateIntegrationById } from "./put";
import { deleteIntegrationById } from "./delete";

const integrationRoutes = new Hono<AppRouteEnv>();

integrationRoutes.get("/", getIntegrations);
integrationRoutes.post("/", createIntegration);
integrationRoutes.get("/:iid", getIntegrationById);
integrationRoutes.put("/:iid", updateIntegrationById);
integrationRoutes.delete("/:iid", deleteIntegrationById);
integrationRoutes.post("/:iid/toggle", toggleIntegration);

export default integrationRoutes;
