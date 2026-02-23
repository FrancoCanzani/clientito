import { createFileRoute } from "@tanstack/react-router";
import { NewReleasePage } from "@/features/releases/pages/new_release_page";

export const Route = createFileRoute("/_dashboard/projects/$project_id/releases/new")({
  component: NewReleasePage,
});
