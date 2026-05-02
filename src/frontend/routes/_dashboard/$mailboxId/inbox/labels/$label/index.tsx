import { emailQueryKeys } from "@/features/email/mail/query-keys";
import { Error as RouteError } from "@/components/error";
import LabelPage from "@/features/email/inbox/pages/label-page";
import { fetchLocalViewPage } from "@/features/email/mail/queries";
import { parseInboxLabelParam } from "@/features/email/mail/views";
import { enqueueMailboxRouteViewSync } from "@/features/email/shell/route-sync";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute(
  "/_dashboard/$mailboxId/inbox/labels/$label/",
)({
  params: {
    parse: (raw) => ({ label: parseInboxLabelParam(raw.label) }),
  },
  skipRouteOnParseError: { params: true },
  beforeLoad: ({ params, preload }) => {
    enqueueMailboxRouteViewSync({
      view: params.label,
      mailboxId: params.mailboxId,
      preload,
    });
  },
  loader: async ({ context, params }) => {
    await context.queryClient.ensureInfiniteQueryData({
      queryKey: emailQueryKeys.list(params.label, params.mailboxId),
      queryFn: ({ pageParam }) =>
        fetchLocalViewPage({
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
