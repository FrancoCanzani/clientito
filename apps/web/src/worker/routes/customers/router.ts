import { OpenAPIHono } from "@hono/zod-openapi";
import { requireAuth } from "../../auth/middleware";
import type { AppRouteEnv } from "../types";
import { registerDeleteCustomerContact } from "./delete-contact";
import { registerDeleteCustomer } from "./delete";
import { registerGetCustomers } from "./get-all";
import { registerGetCustomerById } from "./get";
import { registerPostMergeCustomer } from "./merge";
import { registerPostCustomerContact } from "./post-contact";
import { registerPatchCustomer } from "./patch";
import { registerPostCustomer } from "./post";

const customersRoutes = new OpenAPIHono<AppRouteEnv>();

customersRoutes.use("*", requireAuth);
registerGetCustomers(customersRoutes);
registerGetCustomerById(customersRoutes);
registerPostCustomer(customersRoutes);
registerPatchCustomer(customersRoutes);
registerDeleteCustomer(customersRoutes);
registerPostCustomerContact(customersRoutes);
registerDeleteCustomerContact(customersRoutes);
registerPostMergeCustomer(customersRoutes);

export default customersRoutes;
