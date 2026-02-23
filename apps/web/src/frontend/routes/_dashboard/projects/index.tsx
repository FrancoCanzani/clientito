import { createFileRoute } from "@tanstack/react-router";
import { ProjectsPage } from "@/features/projects/pages/projects_page";

export const Route = createFileRoute("/_dashboard/projects/")({
  component: ProjectsPage,
});
