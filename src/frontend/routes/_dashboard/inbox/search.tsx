import InboxSearchPage from "@/features/inbox/pages/inbox-search-page";
import {
  inboxSearchResultsInfiniteQueryOptions,
  inboxSearchSuggestionsQueryOptions,
} from "@/features/inbox/queries";
import { queryClient } from "@/lib/query-client";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const inboxSearchSchema = z
  .object({
    q: z.string().optional(),
    mailboxId: z.coerce.number().int().positive().optional(),
    includeJunk: z
      .preprocess((value) => {
        if (typeof value === "boolean") return value;
        if (value === "true") return true;
        if (value === "false") return false;
        return value;
      }, z.boolean())
      .optional(),
    view: z
      .enum([
        "inbox",
        "sent",
        "spam",
        "trash",
        "snoozed",
        "archived",
        "starred",
        "important",
      ])
      .optional(),
  })
  .transform((search) => ({
    q: search.q?.trim() ?? "",
    mailboxId: search.mailboxId,
    includeJunk: search.includeJunk,
    view: search.view,
  }));

export const Route = createFileRoute("/_dashboard/inbox/search")({
  validateSearch: inboxSearchSchema,
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    await queryClient.ensureQueryData(inboxSearchSuggestionsQueryOptions(deps));

    if (deps.q.length >= 2) {
      await queryClient.ensureInfiniteQueryData(
        inboxSearchResultsInfiniteQueryOptions(deps),
      );
    }
  },
  component: InboxSearchPage,
});
