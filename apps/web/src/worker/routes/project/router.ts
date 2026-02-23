import { Hono } from "hono";
import type { AppRouteEnv } from "../types";
import { getProjectById, getProjects } from "./get";
import { createProject } from "./post";
import { updateProjectById } from "./put";
import { deleteProjectById } from "./delete";

const projectRoutes = new Hono<AppRouteEnv>();

projectRoutes.get("/", getProjects);
projectRoutes.post("/", createProject);
projectRoutes.get("/:pid", getProjectById);
projectRoutes.put("/:pid", updateProjectById);
projectRoutes.delete("/:pid", deleteProjectById);

export default projectRoutes;
