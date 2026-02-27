import { createFileRoute } from "@tanstack/react-router";
import EmailInboxPage from "@/features/emails/pages/email-inbox-page";

export const Route = createFileRoute("/_dashboard/$orgId/emails/")({
  component: EmailInboxPage,
});
