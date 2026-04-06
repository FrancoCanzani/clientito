import { EmailListPage } from "@/features/inbox/pages/email-list-page";
import { EMAIL_LIST_PAGE_SIZE, fetchEmails } from "@/features/inbox/queries";
import type { EmailListResponse } from "@/features/inbox/types";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { z } from "zod";

const labelSchema = z.enum(["important"]);

export const Route = createFileRoute(
  "/_dashboard/$mailboxId/inbox/labels/$label",
)({
  loader: async ({ context, params }) => {
    const parsedLabelResult = labelSchema.safeParse(params.label);
    if (!parsedLabelResult.success) {
      throw notFound();
    }

    const label = parsedLabelResult.data;
    const view = label;

    await context.queryClient.ensureInfiniteQueryData({
      queryKey: ["emails", view, params.mailboxId],
      queryFn: ({ pageParam }) =>
        fetchEmails({
          view,
          mailboxId: params.mailboxId,
          limit: EMAIL_LIST_PAGE_SIZE,
          offset: pageParam,
        }),
      initialPageParam: 0,
      getNextPageParam: (lastPage: EmailListResponse) =>
        lastPage?.pagination?.hasMore
          ? lastPage.pagination.offset + lastPage.pagination.limit
          : undefined,
    });

    return { label, view };
  },
  component: function LabelPage() {
    const { view } = Route.useLoaderData();
    return <EmailListPage view={view} />;
  },
});
