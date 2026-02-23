import { createFileRoute } from "@tanstack/react-router";
import { ProjectDetailPage } from "@/features/projects/pages/project_detail_page";

export const Route = createFileRoute("/_dashboard/projects/$project_id/")({
  component: ProjectDetailPage,
});
