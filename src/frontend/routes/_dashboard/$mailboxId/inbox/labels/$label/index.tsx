import { Error as RouteError } from "@/components/error";
import LabelPage from "@/features/email/inbox/pages/label-page";
import { fetchEmails, pageSizeForView } from "@/features/email/inbox/queries";
import { parseInboxLabelParam } from "@/features/email/inbox/utils/inbox-filters";
import type { EmailListResponse } from "@/features/email/inbox/types";
import { queryKeys } from "@/lib/query-keys";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute(
  "/_dashboard/$mailboxId/inbox/labels/$label/",
)({
  params: {
    parse: (raw) => ({ label: parseInboxLabelParam(raw.label) }),
  },
  skipRouteOnParseError: { params: true },
  loader: ({ context, params }) => {
    context.queryClient.prefetchInfiniteQuery({
      queryKey: queryKeys.emails.list(params.label, params.mailboxId),
      queryFn: ({ pageParam }) =>
        fetchEmails({
          view: params.label,
          mailboxId: params.mailboxId,
          limit: pageSizeForView(params.label),
          cursor: pageParam === 0 ? undefined : pageParam,
        }),
      initialPageParam: 0,
      pages: 1,
      getNextPageParam: (lastPage: EmailListResponse) =>
        lastPage.pagination.hasMore && lastPage.pagination.cursor
          ? lastPage.pagination.cursor
          : undefined,
    });
  },
  errorComponent: RouteError,
  component: LabelPage,
});
