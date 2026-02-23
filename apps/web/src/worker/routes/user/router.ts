import { Hono } from "hono";
import type { AppRouteEnv } from "../types";
import { getCurrentUser } from "./get";

const userRoutes = new Hono<AppRouteEnv>();

userRoutes.get("/me", getCurrentUser);

export default userRoutes;
