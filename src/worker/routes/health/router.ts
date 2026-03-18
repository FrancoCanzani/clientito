import { Hono } from "hono";
import { getHealth } from "./status";

const healthRoutes = new Hono();

healthRoutes.get("/", getHealth);

export default healthRoutes;
