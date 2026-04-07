import { InboxListView } from "@/features/email/inbox/pages/inbox-list-view";
import { EMAIL_LIST_PAGE_SIZE, fetchEmails } from "@/features/email/inbox/queries";
import { folderParamsSchema } from "@/features/email/inbox/routes/schemas";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute(
  "/_dashboard/$mailboxId/inbox/folders/$folder/",
)({
  params: {
    parse: (raw) => folderParamsSchema.parse(raw),
  },
  skipRouteOnParseError: { params: true },
  loader: async ({ params }) => {
    return {
      initialPage: await fetchEmails({
        view: params.folder,
        mailboxId: params.mailboxId,
        limit: EMAIL_LIST_PAGE_SIZE,
        offset: 0,
      }),
    };
  },
  component: FolderRoutePage,
});

function FolderRoutePage() {
  const { mailboxId, folder } = Route.useParams();
  const { initialPage } = Route.useLoaderData();

  return (
    <InboxListView
      view={folder}
      mailboxId={mailboxId}
      initialPage={initialPage}
    />
  );
}
