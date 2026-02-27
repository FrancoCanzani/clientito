import { fetchEmails } from "@/features/emails/api";
import EmailInboxPage from "@/features/emails/pages/email-inbox-page";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_dashboard/$orgId/emails/")({
  loader: async ({ params }) => {
    const initialEmails = await fetchEmails(params.orgId, {
      limit: 100,
      offset: 0,
    });

    return { initialEmails };
  },
  component: EmailInboxPage,
});
