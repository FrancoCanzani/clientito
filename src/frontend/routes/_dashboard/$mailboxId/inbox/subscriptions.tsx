import SubscriptionsPage from "@/features/subscriptions/pages/subscriptions-page";
import { fetchSubscriptions } from "@/features/subscriptions/queries";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_dashboard/$mailboxId/inbox/subscriptions")({
  loader: async () => {
    const subscriptions = await fetchSubscriptions();
    return { subscriptions };
  },
  component: SubscriptionsPage,
});
