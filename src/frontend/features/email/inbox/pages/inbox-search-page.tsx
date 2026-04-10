import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { SearchResultsList } from "@/features/email/inbox/components/search/search-results-list";
import { SearchSuggestionsList } from "@/features/email/inbox/components/search/search-suggestions-list";
import {
  fetchSearchEmails,
  fetchSearchSuggestions,
  INBOX_SEARCH_PAGE_SIZE,
} from "@/features/email/inbox/queries";
import type { EmailListItem } from "@/features/email/inbox/types";
import { openEmail as openInboxEmail } from "@/features/email/inbox/utils/open-email";
import { useIntersectionObserver } from "@/hooks/use-intersection-observer";
import { useSetPageContext } from "@/hooks/use-page-context";
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useDebouncedCallback } from "use-debounce";

const searchRoute = getRouteApi("/_dashboard/$mailboxId/inbox/search");

function normalizeQuery(query: string) {
  return query.trim().replace(/\s+/g, " ");
}

export default function InboxSearchPage() {
  const { mailboxId } = searchRoute.useParams();
  const { suggestions, initialResults } = searchRoute.useLoaderData();
  const search = searchRoute.useSearch();
  const navigate = searchRoute.useNavigate();
  const queryClient = useQueryClient();
  const routeQuery = search.q ?? "";

  const [query, setSearchQuery] = useState(routeQuery);

  useEffect(() => {
    setSearchQuery(routeQuery);
  }, [routeQuery]);

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
      mailboxId,
      includeJunk: search.includeJunk,
    }),
    [routeQuery, search.includeJunk, mailboxId],
  );

  useSetPageContext(useMemo(() => ({ route: "inbox-search" }), []));

  const resultsQuery = useInfiniteQuery({
    queryKey: [
      "emails",
      "search",
      normalizeQuery(scope.q),
      scope.mailboxId,
      "inbox",
      scope.includeJunk ?? false,
    ] as const,
    initialPageParam: 0,
    enabled: normalizeQuery(scope.q).length >= 2,
    initialData: initialResults
      ? {
          pages: [initialResults],
          pageParams: [0],
        }
      : undefined,
    queryFn: ({ pageParam }) =>
      fetchSearchEmails({
        ...scope,
        q: normalizeQuery(scope.q),
        limit: INBOX_SEARCH_PAGE_SIZE,
        offset: pageParam,
      }),
    getNextPageParam: (lastPage) =>
      lastPage.pagination.hasMore
        ? lastPage.pagination.offset + lastPage.pagination.limit
        : undefined,
    staleTime: 30_000,
  });

  const suggestionsQuery = useQuery({
    queryKey: [
      "emails",
      "search",
      "suggestions",
      normalizeQuery(scope.q),
      scope.mailboxId,
      "inbox",
      scope.includeJunk ?? false,
    ] as const,
    queryFn: () =>
      fetchSearchSuggestions({
        ...scope,
        q: normalizeQuery(scope.q),
      }),
    initialData: suggestions,
    staleTime: 30_000,
  });

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
    const routeMailboxId = email.mailboxId ?? mailboxId;
    if (routeMailboxId == null) return;
    openInboxEmail(queryClient, navigate, routeMailboxId, email);
  }

  const hiddenJunkCount =
    resultsQuery.data?.pages[0]?.searchMeta?.hiddenJunkCount ?? 0;
  const canToggleJunk = hiddenJunkCount > 0 || search.includeJunk === true;

  return (
    <div className="flex min-h-0 h-full w-full max-w-3xl min-w-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col gap-5">
        <PageHeader
          title={
            <div className="flex items-center gap-2">
              <SidebarTrigger className="md:hidden" />
              <span>Search</span>
            </div>
          }
          actions={
            <div className="w-full max-w-72">
              <Input
                className="h-7 text-xs"
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
  );
}
