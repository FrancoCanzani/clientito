import { Error as RouteError } from "@/components/error";
import DraftsPage from "@/features/email/drafts/pages/drafts-page";
import { fetchDrafts } from "@/features/email/mail/data/drafts";
import { draftQueryKeys } from "@/features/email/mail/query-keys";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_dashboard/$mailboxId/inbox/drafts")({
  loader: async ({ context, params }) => {
    const drafts = await context.queryClient.ensureQueryData({
      queryKey: draftQueryKeys.list(params.mailboxId),
      queryFn: () => fetchDrafts(params.mailboxId),
    });
    return { drafts };
  },
  errorComponent: RouteError,
  component: DraftsPage,
});
