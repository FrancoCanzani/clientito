import { Error as RouteError } from "@/components/error";
import FolderPage from "@/features/email/inbox/pages/folder-page";
import { parseEmailFolderParam } from "@/features/email/mail/views";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const folderPageSearchSchema = z.object({
  emailId: z.string().min(1).optional(),
});

export const Route = createFileRoute("/_dashboard/$mailboxId/$folder/")({
  validateSearch: folderPageSearchSchema,
  params: {
    parse: (raw) => ({ folder: parseEmailFolderParam(raw.folder) }),
  },
  skipRouteOnParseError: { params: true },
  errorComponent: RouteError,
  component: FolderPage,
});
