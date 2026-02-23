import { createFileRoute } from "@tanstack/react-router";
import { ChecklistsPage } from "@/features/checklists/pages/checklists_page";

export const Route = createFileRoute("/_dashboard/projects/$project_id/checklists")({
  component: ChecklistsPage,
});
