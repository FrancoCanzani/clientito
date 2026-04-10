import InboxPage from "@/features/email/inbox/pages/inbox-page";
import {
  EMAIL_LIST_PAGE_SIZE,
  fetchEmails,
} from "@/features/email/inbox/queries";
import type { EmailListResponse } from "@/features/email/inbox/types";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_dashboard/$mailboxId/inbox/")({
  loader: async ({ context, params }) => {
    const initialData = await context.queryClient.ensureInfiniteQueryData({
      queryKey: ["emails", "inbox", params.mailboxId],
      queryFn: ({ pageParam }) =>
        fetchEmails({
          view: "inbox",
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
  component: InboxPage,
});
