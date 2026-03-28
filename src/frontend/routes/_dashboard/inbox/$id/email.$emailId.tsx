import EmailDetailPage from "@/features/inbox/pages/email-detail-page";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_dashboard/inbox/$id/email/$emailId")({
  component: EmailDetailPage,
});
