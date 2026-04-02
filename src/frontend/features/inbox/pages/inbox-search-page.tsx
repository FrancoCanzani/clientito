import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchResultsList } from "@/features/inbox/components/search/search-results-list";
import { SearchSuggestionsList } from "@/features/inbox/components/search/search-suggestions-list";
import {
  inboxSearchResultsInfiniteQueryOptions,
  inboxSearchSuggestionsQueryOptions,
} from "@/features/inbox/queries";
import type { EmailListItem } from "@/features/inbox/types";
import { openEmail as openInboxEmail } from "@/features/inbox/utils/open-email";
import { useIntersectionObserver } from "@/hooks/use-intersection-observer";
import { useSetPageContext } from "@/hooks/use-page-context";
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useDebouncedCallback } from "use-debounce";

const searchRoute = getRouteApi("/_dashboard/inbox/search");

export default function InboxSearchPage() {
  const navigate = searchRoute.useNavigate();
  const search = searchRoute.useSearch();
  const queryClient = useQueryClient();
  const routeQuery = search.q ?? "";

  const [query, setSearchQuery] = useState(routeQuery);
  const updateQuery = useDebouncedCallback((nextQuery: string) => {
    navigate({
      search: (prev) => ({
        ...prev,
        q: nextQuery.trim() || undefined,
      }),
      replace: true,
    });
  }, 220);

  const scope = useMemo(
    () => ({
      q: routeQuery,
      mailboxId: search.mailboxId,
      includeJunk: search.includeJunk,
      view: search.view,
    }),
    [routeQuery, search.includeJunk, search.mailboxId, search.view],
  );

  useSetPageContext(useMemo(() => ({ route: "inbox-search" }), []));

  const resultsQuery = useInfiniteQuery(
    inboxSearchResultsInfiniteQueryOptions(scope),
  );
  const suggestionsQuery = useQuery(inboxSearchSuggestionsQueryOptions(scope));

  const results = useMemo(
    () => resultsQuery.data?.pages.flatMap((page) => page.data) ?? [],
    [resultsQuery.data],
  );

  const loadMoreRef = useIntersectionObserver<HTMLDivElement>({
    root: null,
    rootMargin: "200px 0px",
    threshold: 0.01,
    onChange: (isIntersecting) => {
      if (
        !isIntersecting ||
        !resultsQuery.hasNextPage ||
        resultsQuery.isFetchingNextPage ||
        resultsQuery.isFetching
      ) {
        return;
      }

      resultsQuery.fetchNextPage();
    },
  });

  function handleQueryChange(nextQuery: string) {
    setSearchQuery(nextQuery);
    updateQuery(nextQuery);
  }

  function commitQuery(nextQuery: string) {
    updateQuery.cancel();
    setSearchQuery(nextQuery);
    navigate({
      search: (prev) => ({
        ...prev,
        q: nextQuery.trim() || undefined,
      }),
      replace: true,
    });
  }

  function openEmail(email: EmailListItem) {
    const routeMailboxId =
      email.mailboxId != null ? String(email.mailboxId) : "all";

    openInboxEmail(queryClient, navigate, routeMailboxId, email);
  }

  const hiddenJunkCount =
    resultsQuery.data?.pages[0]?.searchMeta?.hiddenJunkCount ?? 0;
  const canToggleJunk =
    search.view !== "spam" &&
    search.view !== "trash" &&
    (hiddenJunkCount > 0 || search.includeJunk === true);

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-3xl min-w-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col gap-5">
        <PageHeader
          title="Search"
          actions={
            <div className="w-full max-w-72">
              <Input
                className="text-xs h-7"
                value={query}
                onChange={(event) => handleQueryChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    commitQuery(query);
                  }
                }}
                placeholder="Search"
                spellCheck={false}
                autoFocus
              />
            </div>
          }
        />

        <div className="flex min-h-0 flex-1 flex-col gap-4">
          <SearchSuggestionsList
            query={query.trim()}
            suggestions={
              suggestionsQuery.data ?? {
                filters: [],
                contacts: [],
                subjects: [],
              }
            }
            onSelectQuery={(nextQuery) => {
              commitQuery(nextQuery);
            }}
          />

          {canToggleJunk && (
            <div className="flex">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  navigate({
                    search: (prev) => ({
                      ...prev,
                      includeJunk: prev.includeJunk ? undefined : true,
                    }),
                    replace: true,
                  })
                }
              >
                {search.includeJunk
                  ? "Hide spam and trash"
                  : `Show spam and trash${hiddenJunkCount > 0 ? ` (${hiddenJunkCount})` : ""}`}
              </Button>
            </div>
          )}

          <div className="flex min-h-0 flex-1 flex-col">
            <SearchResultsList
              query={routeQuery.trim()}
              results={results}
              isPending={resultsQuery.isPending}
              hasNextPage={resultsQuery.hasNextPage ?? false}
              isFetchingNextPage={resultsQuery.isFetchingNextPage}
              loadMoreRef={loadMoreRef}
              onOpenEmail={openEmail}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
