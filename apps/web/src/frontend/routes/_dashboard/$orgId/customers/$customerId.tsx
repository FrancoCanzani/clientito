import { createFileRoute } from "@tanstack/react-router";
import CustomerDetailPage from "@/features/customers/pages/customer-detail-page";

export const Route = createFileRoute(
  "/_dashboard/$orgId/customers/$customerId",
)({
  component: CustomerDetailPage,
});
