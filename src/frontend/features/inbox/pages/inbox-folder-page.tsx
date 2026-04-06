import { InboxListView } from "@/features/inbox/pages/inbox-list-view";
import { getRouteApi } from "@tanstack/react-router";

const folderRoute = getRouteApi("/_dashboard/$mailboxId/inbox/folders/$folder/");

export default function InboxFolderPage() {
  const { mailboxId, folder } = folderRoute.useParams();
  const { initialPage } = folderRoute.useLoaderData();

  return (
    <InboxListView
      view={folder}
      mailboxId={mailboxId}
      initialPage={initialPage}
    />
  );
}
