import { EmailListPage } from "@/features/inbox/pages/email-list-page";
import { EMAIL_LIST_PAGE_SIZE, fetchEmails } from "@/features/inbox/queries";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_dashboard/$mailboxId/inbox/archived")({
  loader: ({ params }) =>
    fetchEmails({
      view: "archived",
      mailboxId: params.mailboxId,
      limit: EMAIL_LIST_PAGE_SIZE,
      offset: 0,
    }),
  component: function ArchivedPage() {
    const { mailboxId } = Route.useParams();
    const initialPage = Route.useLoaderData();
    return (
      <EmailListPage view="archived" mailboxId={mailboxId} initialPage={initialPage} />
    );
  },
});
