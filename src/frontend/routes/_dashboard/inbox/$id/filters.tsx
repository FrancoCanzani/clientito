import FiltersPage from "@/features/filters/pages/filters-page";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_dashboard/inbox/$id/filters")({
  component: FiltersPage,
});
