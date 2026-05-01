import { Error as RouteError } from "@/components/error";
import { fetchViewPage } from "@/features/email/inbox/queries";
import { emailQueryKeys } from "@/features/email/inbox/query-keys";
import {
  REMINDERS_VIEW,
  RemindersPage,
} from "@/features/email/reminders/pages/reminders-page";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_dashboard/$mailboxId/reminders")({
  loader: async ({ context, params }) => {
    await context.queryClient.ensureInfiniteQueryData({
      queryKey: emailQueryKeys.list(REMINDERS_VIEW, params.mailboxId),
      queryFn: ({ pageParam }) =>
        fetchViewPage({
          view: REMINDERS_VIEW,
          mailboxId: params.mailboxId,
          cursor: pageParam || undefined,
        }),
      initialPageParam: "",
      pages: 1,
      getNextPageParam: (lastPage) => lastPage?.cursor ?? undefined,
    });
  },
  errorComponent: RouteError,
  component: RemindersRoute,
});

function RemindersRoute() {
  const { mailboxId } = Route.useParams();
  return <RemindersPage mailboxId={mailboxId} />;
}
