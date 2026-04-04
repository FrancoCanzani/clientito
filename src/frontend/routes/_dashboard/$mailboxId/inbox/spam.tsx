import SpamPage from "@/features/inbox/pages/spam-page";
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
  component: SpamPage,
});
