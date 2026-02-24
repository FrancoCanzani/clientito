import { Hono } from "hono";
import { getHealth } from "./get";

const healthRoutes = new Hono();

healthRoutes.get("/", getHealth);

export default healthRoutes;
