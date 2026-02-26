import { createFileRoute } from "@tanstack/react-router";
import EmailSearchPage from "@/features/emails/pages/email-search-page";

export const Route = createFileRoute("/_dashboard/$orgId/emails/")({
  component: EmailSearchPage,
});
