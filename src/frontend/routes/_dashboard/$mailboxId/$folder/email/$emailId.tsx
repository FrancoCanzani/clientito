import { Error as RouteError } from "@/components/error";
import FolderEmailPage from "@/features/email/inbox/pages/folder-email-page";
import {
  parseEmailFolderParam,
  parseEmailIdParam,
} from "@/features/email/mail/views";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_dashboard/$mailboxId/$folder/email/$emailId")({
  params: {
    parse: (raw) => ({
      folder: parseEmailFolderParam(raw.folder),
      emailId: parseEmailIdParam(raw.emailId),
    }),
  },
  skipRouteOnParseError: { params: true },
  errorComponent: RouteError,
  component: FolderEmailPage,
});
