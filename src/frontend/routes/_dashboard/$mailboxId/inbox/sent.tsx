import SentPage from "@/features/inbox/pages/sent-page";
import { EMAIL_LIST_PAGE_SIZE, fetchEmails } from "@/features/inbox/queries";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_dashboard/$mailboxId/inbox/sent")({
  loader: ({ params }) =>
    fetchEmails({
      view: "sent",
      mailboxId: params.mailboxId,
      limit: EMAIL_LIST_PAGE_SIZE,
      offset: 0,
    }),
  component: SentPage,
});
