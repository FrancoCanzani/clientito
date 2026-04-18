import { LoadingEmailsPending } from "@/components/loading-emails-pending";
import { Error as RouteError } from "@/components/error";
import InboxPage from "@/features/email/inbox/pages/inbox-page";
import { fetchViewPage } from "@/features/email/inbox/queries";
import { queryKeys } from "@/lib/query-keys";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_dashboard/$mailboxId/inbox/")({
  loader: async ({ context, params }) => {
    await context.queryClient.prefetchInfiniteQuery({
      queryKey: queryKeys.emails.list("inbox", params.mailboxId),
      queryFn: ({ pageParam }) =>
        fetchViewPage({
          view: "inbox",
          mailboxId: params.mailboxId,
          cursor: pageParam || undefined,
        }),
      initialPageParam: "",
      pages: 1,
      getNextPageParam: (lastPage) => lastPage?.cursor ?? undefined,
    });
  },
  pendingComponent: LoadingEmailsPending,
  errorComponent: RouteError,
  component: InboxPage,
});
