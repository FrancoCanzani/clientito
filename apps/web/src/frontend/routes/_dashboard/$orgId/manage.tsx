import { createFileRoute } from "@tanstack/react-router";
import ManageOrganizationPage from "@/features/workspace/pages/manage-organization-page";

export const Route = createFileRoute("/_dashboard/$orgId/manage")({
  component: ManageOrganizationPage,
});
