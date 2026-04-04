import EmailInboxPage from "@/features/inbox/pages/email-inbox-page";
import { emailListInfiniteQueryOptions } from "@/features/inbox/queries";
import { queryClient } from "@/lib/query-client";
import { parseMailboxId } from "@/lib/utils";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_dashboard/inbox/$id/archived")({
  loader: async ({ params }) => {
    const mailboxId = parseMailboxId(params.id) ?? null;
    await queryClient.ensureInfiniteQueryData(
      emailListInfiniteQueryOptions({ view: "archived", mailboxId }),
    );
    return { mailboxId };
  },
  component: MailboxArchivedRoute,
});

function MailboxArchivedRoute() {
  const { mailboxId } = Route.useLoaderData();
  return <EmailInboxPage view="archived" mailboxId={mailboxId} />;
}
