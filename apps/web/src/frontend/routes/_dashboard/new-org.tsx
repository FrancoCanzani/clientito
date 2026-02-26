import { createFileRoute } from "@tanstack/react-router";
import NewOrganizationPage from "@/features/workspace/pages/new-organization-page";

export const Route = createFileRoute("/_dashboard/new-org")({
  component: NewOrganizationPage,
});
