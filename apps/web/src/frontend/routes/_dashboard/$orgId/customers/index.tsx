import { createFileRoute } from "@tanstack/react-router";
import CustomersPage from "@/features/customers/pages/customers-page";

export const Route = createFileRoute("/_dashboard/$orgId/customers/")({
  component: CustomersPage,
});
