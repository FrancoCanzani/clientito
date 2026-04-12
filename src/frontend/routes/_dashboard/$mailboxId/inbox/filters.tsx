import { Error as RouteError } from "@/components/error";
import FiltersPage from "@/features/email/filters/pages/filters-page";
import { fetchFilters } from "@/features/email/filters/queries";
import { queryKeys } from "@/lib/query-keys";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_dashboard/$mailboxId/inbox/filters")({
  loader: async ({ context }) => {
    const filters = await context.queryClient.ensureQueryData({
      queryKey: queryKeys.filters(),
      queryFn: fetchFilters,
    });
    return { filters };
  },
  errorComponent: RouteError,
  component: FiltersPage,
});
