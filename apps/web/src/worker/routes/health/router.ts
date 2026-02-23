import { Hono } from "hono";
import { getHealth } from "./get";

const healthRoutes = new Hono<{ Bindings: Env }>();

healthRoutes.get("/", getHealth);

export default healthRoutes;
