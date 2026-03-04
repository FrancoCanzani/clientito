import { Hono } from "hono";
import { requireAuth } from "../../middleware/auth";
import type { AppRouteEnv } from "../types";
import { registerGetPeople, registerGetPersonById } from "./get";
import { registerPatchPeople } from "./patch";
import { registerPostPeople } from "./post";

const peopleRoutes = new Hono<AppRouteEnv>();

peopleRoutes.use("*", requireAuth);
registerGetPeople(peopleRoutes);
registerGetPersonById(peopleRoutes);
registerPostPeople(peopleRoutes);
registerPatchPeople(peopleRoutes);

export default peopleRoutes;
