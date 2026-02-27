import { OpenAPIHono } from "@hono/zod-openapi";
import { requireAuth } from "../../auth/middleware";
import type { AppRouteEnv } from "../types";
import { registerGetContacts } from "./list";
import { registerPostContacts } from "./create";

const contactsRoutes = new OpenAPIHono<AppRouteEnv>();

contactsRoutes.use("*", requireAuth);
registerGetContacts(contactsRoutes);
registerPostContacts(contactsRoutes);

export default contactsRoutes;
