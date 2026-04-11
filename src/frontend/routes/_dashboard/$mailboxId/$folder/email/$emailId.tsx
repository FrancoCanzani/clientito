import FolderEmailPage from "@/features/email/inbox/pages/folder-email-page";
import { fetchEmailDetail, fetchEmailDetailAI } from "@/features/email/inbox/queries";
import {
  parseEmailFolderParam,
  parseEmailIdParam,
} from "@/features/email/inbox/utils/inbox-filters";
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
    const email = await context.queryClient.ensureQueryData({
      queryKey: ["email-detail", params.emailId],
      queryFn: () => fetchEmailDetail(params.emailId),
    });

    void context.queryClient.prefetchQuery({
      queryKey: ["email-ai-detail", params.emailId],
      queryFn: () => fetchEmailDetailAI(params.emailId),
    });

    return { email };
  },
  staleTime: 60_000,
  gcTime: 10 * 60_000,
  component: FolderEmailPage,
});
