import TrashPage from "@/features/inbox/pages/trash-page";
import { fetchEmails } from "@/features/inbox/queries";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_dashboard/$mailboxId/inbox/trash")({
  loader: ({ params }) =>
    fetchEmails({
      view: "trash",
      mailboxId: params.mailboxId,
      offset: 0,
    }),
  component: TrashPage,
});
