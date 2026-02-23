import { createFileRoute } from "@tanstack/react-router";
import { ReleaseDetailPage } from "@/features/releases/pages/release_detail_page";

export const Route = createFileRoute("/_dashboard/projects/$project_id/releases/$release_id")({
  component: ReleaseDetailPage,
});
