import { InboxListView } from "@/features/inbox/pages/inbox-list-view";
import { getRouteApi } from "@tanstack/react-router";

const inboxRoute = getRouteApi("/_dashboard/$mailboxId/inbox/");

export default function InboxPage() {
  const { mailboxId } = inboxRoute.useParams();
  const { initialPage } = inboxRoute.useLoaderData();

  return (
    <InboxListView
      view="inbox"
      mailboxId={mailboxId}
      initialPage={initialPage}
    />
  );
}
