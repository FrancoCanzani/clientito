import InboxSearchPage from "@/features/inbox/pages/inbox-search-page";
import {
  inboxSearchResultsInfiniteQueryOptions,
  inboxSearchSuggestionsQueryOptions,
} from "@/features/inbox/queries";
import { queryClient } from "@/lib/query-client";
import { parseMailboxId } from "@/lib/utils";
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

export const Route = createFileRoute("/_dashboard/inbox/$id/search")({
  validateSearch: inboxSearchSchema,
  loaderDeps: ({ search }) => search,
  loader: async ({ deps, params }) => {
    const mailboxId = parseMailboxId(params.id);
    const scope = {
      ...deps,
      mailboxId,
    };

    await queryClient.ensureQueryData(
      inboxSearchSuggestionsQueryOptions(scope),
    );

    if (scope.q.length >= 2) {
      await queryClient.ensureInfiniteQueryData(
        inboxSearchResultsInfiniteQueryOptions(scope),
      );
    }

    return scope;
  },
  component: MailboxSearchRoute,
});

function MailboxSearchRoute() {
  const search = Route.useSearch();
  const params = Route.useParams();
  const mailboxId = parseMailboxId(params.id) ?? null;

  return <InboxSearchPage mailboxId={mailboxId} search={search} />;
}
