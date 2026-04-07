import SubscriptionsPage from "@/features/email/subscriptions/pages/subscriptions-page";
import { fetchSubscriptions } from "@/features/email/subscriptions/queries";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_dashboard/$mailboxId/inbox/subscriptions")({
  loader: async () => {
    const subscriptions = await fetchSubscriptions();
    return { subscriptions };
  },
  component: SubscriptionsPage,
});
