import LabelPage from "@/features/email/inbox/pages/label-page";
import { EMAIL_LIST_PAGE_SIZE, fetchEmails } from "@/features/email/inbox/queries";
import { labelParamsSchema } from "@/features/email/inbox/routes/schemas";
import type { EmailListResponse } from "@/features/email/inbox/types";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute(
  "/_dashboard/$mailboxId/inbox/labels/$label/",
)({
  params: {
    parse: (raw) => labelParamsSchema.parse(raw),
  },
  skipRouteOnParseError: { params: true },
  loader: async ({ context, params }) => {
    const initialData = await context.queryClient.ensureInfiniteQueryData({
      queryKey: ["emails", params.label, params.mailboxId] as const,
      queryFn: ({ pageParam }) =>
        fetchEmails({
          view: params.label,
          mailboxId: params.mailboxId,
          limit: EMAIL_LIST_PAGE_SIZE,
          offset: pageParam,
        }),
      initialPageParam: 0,
      getNextPageParam: (lastPage: EmailListResponse) =>
        lastPage.pagination.hasMore
          ? lastPage.pagination.offset + lastPage.pagination.limit
          : undefined,
    });

    return {
      initialPage: initialData.pages[0],
    };
  },
  component: LabelPage,
});
