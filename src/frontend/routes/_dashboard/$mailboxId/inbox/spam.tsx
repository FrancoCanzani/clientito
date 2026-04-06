import { EmailListPage } from "@/features/inbox/pages/email-list-page";
import { EMAIL_LIST_PAGE_SIZE, fetchEmails } from "@/features/inbox/queries";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_dashboard/$mailboxId/inbox/spam")({
  loader: ({ params }) =>
    fetchEmails({
      view: "spam",
      mailboxId: params.mailboxId,
      limit: EMAIL_LIST_PAGE_SIZE,
      offset: 0,
    }),
  component: function SpamPage() {
    const { mailboxId } = Route.useParams();
    const initialPage = Route.useLoaderData();
    return (
      <EmailListPage view="spam" mailboxId={mailboxId} initialPage={initialPage} />
    );
  },
});
