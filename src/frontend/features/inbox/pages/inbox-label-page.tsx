import { InboxListView } from "@/features/inbox/pages/inbox-list-view";
import { getRouteApi } from "@tanstack/react-router";

const labelRoute = getRouteApi("/_dashboard/$mailboxId/inbox/labels/$label/");

export default function InboxLabelPage() {
  const { mailboxId, label } = labelRoute.useParams();
  const { initialPage } = labelRoute.useLoaderData();

  return (
    <InboxListView
      view={label}
      mailboxId={mailboxId}
      initialPage={initialPage}
    />
  );
}
