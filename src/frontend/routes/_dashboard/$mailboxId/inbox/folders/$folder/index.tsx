import InboxFolderPage from "@/features/inbox/pages/inbox-folder-page";
import { EMAIL_LIST_PAGE_SIZE, fetchEmails } from "@/features/inbox/queries";
import { folderParamsSchema } from "@/features/inbox/routes/schemas";
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
  component: InboxFolderPage,
});
