import { createFileRoute } from "@tanstack/react-router";
import { IntegrationsPage } from "@/features/integrations/pages/integrations_page";

export const Route = createFileRoute("/_dashboard/projects/$project_id/integrations")({
  component: IntegrationsPage,
});
