import InboxPage from "@/features/email/inbox/pages/inbox-page";
import { EMAIL_LIST_PAGE_SIZE, fetchEmails } from "@/features/email/inbox/queries";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_dashboard/$mailboxId/inbox/")({
  loader: async ({ params }) => {
    return {
      initialPage: await fetchEmails({
        view: "inbox",
        mailboxId: params.mailboxId,
        limit: EMAIL_LIST_PAGE_SIZE,
        offset: 0,
      }),
    };
  },
  component: InboxPage,
});
