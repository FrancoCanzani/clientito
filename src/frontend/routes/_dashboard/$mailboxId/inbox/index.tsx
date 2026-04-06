import InboxPage from "@/features/inbox/pages/inbox-page";
import {
  EMAIL_LIST_PAGE_SIZE,
  fetchEmailDetailAI,
  fetchEmails,
} from "@/features/inbox/queries";
import type { EmailListResponse } from "@/features/inbox/types";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const emailsSearchSchema = z.object({
  view: z.enum(["important"]).optional(),
});

export const Route = createFileRoute("/_dashboard/$mailboxId/inbox/")({
  validateSearch: emailsSearchSchema,
  loaderDeps: ({ search }) => ({
    view: (search.view ?? "inbox") as "important" | "inbox",
  }),
  loader: async ({ context, deps, params }) => {
    const data = await context.queryClient.ensureInfiniteQueryData({
      queryKey: ["emails", deps.view, params.mailboxId],
      queryFn: ({ pageParam }) =>
        fetchEmails({
          view: deps.view,
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

    const initialPage = data.pages[0];
    if (initialPage) {
      const unreadIds = initialPage.data
        .filter((email) => !email.isRead)
        .slice(0, 5)
        .map((email) => email.id);

      for (const emailId of unreadIds) {
        void context.queryClient.prefetchQuery({
          queryKey: ["email-ai-detail", emailId],
          queryFn: () => fetchEmailDetailAI(emailId),
        });
      }
    }

    return { view: deps.view, initialPage };
  },
  component: InboxPage,
});
