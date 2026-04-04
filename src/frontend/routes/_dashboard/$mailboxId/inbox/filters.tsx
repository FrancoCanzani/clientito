import FiltersPage from "@/features/filters/pages/filters-page";
import { fetchFilters } from "@/features/filters/queries";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_dashboard/$mailboxId/inbox/filters")({
  loader: async () => {
    const filters = await fetchFilters();
    return { filters };
  },
  component: FiltersPage,
});
