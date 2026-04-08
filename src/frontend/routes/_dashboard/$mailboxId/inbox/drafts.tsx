import DraftsPage from "@/features/email/inbox/pages/drafts-page";
import { fetchDrafts } from "@/features/email/inbox/queries";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_dashboard/$mailboxId/inbox/drafts")({
  loader: async ({ params }) => {
    const drafts = await fetchDrafts(params.mailboxId);
    return { drafts };
  },
  component: DraftsPage,
});
