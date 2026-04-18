import { Error as RouteError } from "@/components/error";
import InboxSearchPage from "@/features/email/inbox/pages/inbox-search-page";
import {
  fetchSearchEmails,
  fetchSearchSuggestions,
} from "@/features/email/inbox/queries";
import type { EmailListPage } from "@/features/email/inbox/types";
import { queryKeys } from "@/lib/query-keys";
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
    const includeJunk = scope.includeJunk ?? false;
    const suggestions = await context.queryClient.ensureQueryData({
      queryKey: queryKeys.emails.search.suggestions(
        normalizedQuery,
        scope.mailboxId,
        "inbox",
        includeJunk,
      ),
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
              queryKey: queryKeys.emails.search.results(
                normalizedQuery,
                scope.mailboxId,
                "inbox",
                includeJunk,
              ),
              queryFn: ({ pageParam }) =>
                fetchSearchEmails({
                  ...scope,
                  q: normalizedQuery,
                  cursor: pageParam || undefined,
                }),
              initialPageParam: "",
              getNextPageParam: (lastPage: EmailListPage) =>
                lastPage.cursor ?? undefined,
            })
          ).pages[0]
        : null;
    return { suggestions, initialResults };
  },
  errorComponent: RouteError,
  component: InboxSearchPage,
});
