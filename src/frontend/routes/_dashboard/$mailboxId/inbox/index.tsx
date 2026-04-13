import { Error as RouteError } from "@/components/error";
import InboxPage from "@/features/email/inbox/pages/inbox-page";
import {
  EMAIL_LIST_PAGE_SIZE,
  fetchEmails,
} from "@/features/email/inbox/queries";
import type { EmailListResponse } from "@/features/email/inbox/types";
import { queryKeys } from "@/lib/query-keys";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_dashboard/$mailboxId/inbox/")({
  loader: ({ context, params }) => {
    context.queryClient.prefetchInfiniteQuery({
      queryKey: queryKeys.emails.list("inbox", params.mailboxId),
      queryFn: ({ pageParam }) =>
        fetchEmails({
          view: "inbox",
          mailboxId: params.mailboxId,
          limit: EMAIL_LIST_PAGE_SIZE,
          cursor: pageParam === 0 ? undefined : pageParam,
        }),
      initialPageParam: 0,
      pages: 2,
      getNextPageParam: (lastPage: EmailListResponse) =>
        lastPage.pagination.hasMore && lastPage.pagination.cursor
          ? lastPage.pagination.cursor
          : undefined,
    });
  },
  errorComponent: RouteError,
  component: InboxPage,
});
