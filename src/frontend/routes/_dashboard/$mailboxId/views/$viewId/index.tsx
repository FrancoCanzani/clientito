import { Error as RouteError } from "@/components/error";
import SplitViewPage from "@/features/email/inbox/pages/split-view-page";
import { fetchSplitViews } from "@/features/email/split-views/queries";
import { splitViewQueryKeys } from "@/features/email/split-views/query-keys";
import { createFileRoute, notFound } from "@tanstack/react-router";

export const Route = createFileRoute("/_dashboard/$mailboxId/views/$viewId/")({
  loader: async ({ context, params }) => {
    const splitViews = await context.queryClient.ensureQueryData({
      queryKey: splitViewQueryKeys.all(),
      queryFn: fetchSplitViews,
      staleTime: 60_000,
    });

    if (!splitViews.some((view) => view.id === params.viewId)) {
      throw notFound();
    }
  },
  errorComponent: RouteError,
  component: SplitViewPage,
});
