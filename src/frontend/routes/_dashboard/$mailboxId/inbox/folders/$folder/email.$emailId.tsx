import FolderPage from "@/features/email/inbox/pages/folder-page";
import { fetchEmailDetail, fetchEmailDetailAI } from "@/features/email/inbox/queries";
import { folderEmailParamsSchema } from "@/features/email/inbox/routes/schemas";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute(
  "/_dashboard/$mailboxId/inbox/folders/$folder/email/$emailId",
)({
  params: {
    parse: (raw) => folderEmailParamsSchema.parse(raw),
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
  component: FolderPage,
});
