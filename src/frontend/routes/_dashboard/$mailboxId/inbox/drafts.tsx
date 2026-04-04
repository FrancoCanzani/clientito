import DraftsPage from "@/features/inbox/pages/drafts-page";
import { fetchDrafts } from "@/features/inbox/queries/drafts";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_dashboard/$mailboxId/inbox/drafts")({
  loader: ({ params }) => fetchDrafts(params.mailboxId),
  component: DraftsPage,
});
