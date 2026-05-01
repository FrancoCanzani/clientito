import { emailQueryKeys } from "@/features/email/inbox/query-keys";
import { Error as RouteError } from "@/components/error";
import LabelPage from "@/features/email/inbox/pages/label-page";
import { fetchViewPage } from "@/features/email/inbox/queries";
import { parseInboxLabelParam } from "@/features/email/inbox/utils/inbox-filters";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute(
  "/_dashboard/$mailboxId/inbox/labels/$label/",
)({
  params: {
    parse: (raw) => ({ label: parseInboxLabelParam(raw.label) }),
  },
  skipRouteOnParseError: { params: true },
  loader: async ({ context, params }) => {
    await context.queryClient.ensureInfiniteQueryData({
      queryKey: emailQueryKeys.list(params.label, params.mailboxId),
      queryFn: ({ pageParam }) =>
        fetchViewPage({
          view: params.label,
          mailboxId: params.mailboxId,
          cursor: pageParam || undefined,
        }),
      initialPageParam: "",
      pages: 1,
      getNextPageParam: (lastPage) => lastPage?.cursor ?? undefined,
    });
  },
  errorComponent: RouteError,
  component: LabelPage,
});
