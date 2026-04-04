import StarredPage from "@/features/inbox/pages/starred-page";
import { EMAIL_LIST_PAGE_SIZE, fetchEmails } from "@/features/inbox/queries";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_dashboard/$mailboxId/inbox/starred")({
  loader: ({ params }) =>
    fetchEmails({
      view: "starred",
      mailboxId: params.mailboxId,
      limit: EMAIL_LIST_PAGE_SIZE,
      offset: 0,
    }),
  component: StarredPage,
});
