import DraftsPage from "@/features/email/inbox/pages/drafts-page";
import { fetchDrafts, getDraftsQueryKey } from "@/features/email/inbox/queries";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_dashboard/$mailboxId/inbox/drafts")({
  loader: async ({ context, params }) => {
    const drafts = await context.queryClient.ensureQueryData({
      queryKey: getDraftsQueryKey(params.mailboxId),
      queryFn: () => fetchDrafts(params.mailboxId),
    });
    return { drafts };
  },
  component: DraftsPage,
});
