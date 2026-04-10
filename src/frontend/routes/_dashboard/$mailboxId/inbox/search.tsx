import InboxSearchPage from "@/features/email/inbox/pages/inbox-search-page";
import {
  fetchSearchEmails,
  fetchSearchSuggestions,
  INBOX_SEARCH_PAGE_SIZE,
} from "@/features/email/inbox/queries";
import type { EmailListResponse } from "@/features/email/inbox/types";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const inboxSearchSchema = z
  .object({
    q: z.string().optional(),
    includeJunk: z
      .preprocess((value) => {
        if (typeof value === "boolean") return value;
        if (value === "true") return true;
        if (value === "false") return false;
        return value;
      }, z.boolean())
      .optional(),
  })
  .transform((search) => ({
    q: search.q?.trim() ?? "",
    includeJunk: search.includeJunk,
  }));

export const Route = createFileRoute("/_dashboard/$mailboxId/inbox/search")({
  validateSearch: inboxSearchSchema,
  loaderDeps: ({ search }) => search,
  loader: async ({ context, deps, params }) => {
    const normalizedQuery = deps.q.trim().replace(/\s+/g, " ");
    const scope = { ...deps, mailboxId: params.mailboxId };
    const suggestions = await context.queryClient.ensureQueryData({
      queryKey: [
        "emails",
        "search",
        "suggestions",
        normalizedQuery,
        scope.mailboxId,
        "inbox",
        scope.includeJunk ?? false,
      ] as const,
      queryFn: () =>
        fetchSearchSuggestions({
          ...scope,
          q: normalizedQuery,
        }),
    });
    const initialResults =
      normalizedQuery.length >= 2
        ? (
            await context.queryClient.ensureInfiniteQueryData({
              queryKey: [
                "emails",
                "search",
                normalizedQuery,
                scope.mailboxId,
                "inbox",
                scope.includeJunk ?? false,
              ] as const,
              queryFn: ({ pageParam }) =>
                fetchSearchEmails({
                  ...scope,
                  q: normalizedQuery,
                  limit: INBOX_SEARCH_PAGE_SIZE,
                  offset: pageParam,
                }),
              initialPageParam: 0,
              getNextPageParam: (lastPage: EmailListResponse) =>
                lastPage.pagination.hasMore
                  ? lastPage.pagination.offset + lastPage.pagination.limit
                  : undefined,
            })
          ).pages[0]
        : null;
    return { suggestions, initialResults };
  },
  component: InboxSearchPage,
});
