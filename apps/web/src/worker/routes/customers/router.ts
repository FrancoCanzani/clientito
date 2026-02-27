import { OpenAPIHono } from "@hono/zod-openapi";
import { requireAuth } from "../../auth/middleware";
import type { AppRouteEnv } from "../types";
import { registerDeleteCustomerContact } from "./remove-contact";
import { registerDeleteCustomer } from "./remove";
import { registerGetCustomers } from "./list";
import { registerGetCustomerById } from "./detail";
import { registerPostMergeCustomer } from "./merge";
import { registerPostCustomerContact } from "./add-contact";
import { registerPatchCustomer } from "./update";
import { registerGetCustomerSummary } from "./summary";
import { registerPostCustomer } from "./create";

const customersRoutes = new OpenAPIHono<AppRouteEnv>();

customersRoutes.use("*", requireAuth);
registerGetCustomers(customersRoutes);
registerGetCustomerById(customersRoutes);
registerGetCustomerSummary(customersRoutes);
registerPostCustomer(customersRoutes);
registerPatchCustomer(customersRoutes);
registerDeleteCustomer(customersRoutes);
registerPostCustomerContact(customersRoutes);
registerDeleteCustomerContact(customersRoutes);
registerPostMergeCustomer(customersRoutes);

export default customersRoutes;
