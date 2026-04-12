import { Error as RouteError } from "@/components/error";
import FolderEmailPage from "@/features/email/inbox/pages/folder-email-page";
import {
  parseEmailFolderParam,
  parseEmailIdParam,
} from "@/features/email/inbox/utils/inbox-filters";
import {
  createEmailDetailLoader,
  emailDetailRouteOptions,
} from "@/lib/email-detail-loader";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_dashboard/$mailboxId/$folder/email/$emailId")({
  params: {
    parse: (raw) => ({
      folder: parseEmailFolderParam(raw.folder),
      emailId: parseEmailIdParam(raw.emailId),
    }),
  },
  skipRouteOnParseError: { params: true },
  loader: async ({ context, params }) => {
    const load = createEmailDetailLoader(params.folder);
    return load({ context, params });
  },
  ...emailDetailRouteOptions,
  errorComponent: RouteError,
  component: FolderEmailPage,
});
