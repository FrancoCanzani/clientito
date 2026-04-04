import InboxSearchPage from "@/features/inbox/pages/inbox-search-page";
import {
  fetchSearchEmails,
  fetchSearchSuggestions,
  INBOX_SEARCH_PAGE_SIZE,
} from "@/features/inbox/queries";
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
  loader: async ({ deps, params }) => {
    const scope = { ...deps, mailboxId: params.mailboxId };
    const suggestions = await fetchSearchSuggestions(scope);
    const initialResults =
      scope.q.length >= 2
        ? await fetchSearchEmails({
            ...scope,
            limit: INBOX_SEARCH_PAGE_SIZE,
            offset: 0,
          })
        : null;
    return { suggestions, initialResults };
  },
  component: InboxSearchPage,
});
