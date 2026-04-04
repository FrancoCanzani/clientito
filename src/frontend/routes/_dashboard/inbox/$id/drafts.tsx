import DraftsPage from "@/features/inbox/pages/drafts-page";
import { draftsQueryOptions } from "@/features/inbox/queries/drafts";
import { queryClient } from "@/lib/query-client";
import { parseMailboxId } from "@/lib/utils";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_dashboard/inbox/$id/drafts")({
  loader: async ({ params }) => {
    const mailboxId = parseMailboxId(params.id) ?? null;
    await queryClient.ensureQueryData(draftsQueryOptions(mailboxId));
    return { mailboxId };
  },
  component: MailboxDraftsRoute,
});

function MailboxDraftsRoute() {
  const { mailboxId } = Route.useLoaderData();
  return <DraftsPage mailboxId={mailboxId} />;
}
