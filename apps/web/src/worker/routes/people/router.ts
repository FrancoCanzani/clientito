import { OpenAPIHono } from "@hono/zod-openapi";
import { requireAuth } from "../../auth/middleware";
import type { AppRouteEnv } from "../types";
import { registerGetPeople, registerGetPersonById } from "./get";
import { registerPatchPeople } from "./patch";
import { registerPostPeople } from "./post";

const peopleRoutes = new OpenAPIHono<AppRouteEnv>();

peopleRoutes.use("*", requireAuth);
registerGetPeople(peopleRoutes);
registerGetPersonById(peopleRoutes);
registerPostPeople(peopleRoutes);
registerPatchPeople(peopleRoutes);

export default peopleRoutes;
