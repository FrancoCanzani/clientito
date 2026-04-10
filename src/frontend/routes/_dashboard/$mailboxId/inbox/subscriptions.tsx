import SubscriptionsPage from "@/features/email/subscriptions/pages/subscriptions-page";
import { fetchSubscriptions } from "@/features/email/subscriptions/queries";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_dashboard/$mailboxId/inbox/subscriptions")({
  loader: async ({ context }) => {
    const subscriptions = await context.queryClient.ensureQueryData({
      queryKey: ["subscriptions"] as const,
      queryFn: fetchSubscriptions,
    });
    return { subscriptions };
  },
  component: SubscriptionsPage,
});
