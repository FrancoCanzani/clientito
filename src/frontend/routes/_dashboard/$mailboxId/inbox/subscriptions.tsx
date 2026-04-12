import { Error as RouteError } from "@/components/error";
import SubscriptionsPage from "@/features/email/subscriptions/pages/subscriptions-page";
import { fetchSubscriptions } from "@/features/email/subscriptions/queries";
import { queryKeys } from "@/lib/query-keys";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_dashboard/$mailboxId/inbox/subscriptions")({
  loader: async ({ context }) => {
    const subscriptions = await context.queryClient.ensureQueryData({
      queryKey: queryKeys.subscriptions(),
      queryFn: fetchSubscriptions,
    });
    return { subscriptions };
  },
  errorComponent: RouteError,
  component: SubscriptionsPage,
});
