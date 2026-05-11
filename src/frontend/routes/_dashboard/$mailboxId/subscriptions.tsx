import SubscriptionsPage from "@/features/email/subscriptions/pages/subscriptions-page";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_dashboard/$mailboxId/subscriptions")({
  component: SubscriptionsPage,
});
