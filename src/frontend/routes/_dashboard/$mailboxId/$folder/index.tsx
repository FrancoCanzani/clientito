import FolderPage from "@/features/email/inbox/pages/folder-page";
import { EMAIL_LIST_PAGE_SIZE, fetchEmails } from "@/features/email/inbox/queries";
import { folderParamsSchema } from "@/features/email/inbox/routes/schemas";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_dashboard/$mailboxId/$folder/")({
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
  component: FolderPage,
});
