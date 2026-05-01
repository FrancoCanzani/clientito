import { emailQueryKeys } from "@/features/email/inbox/query-keys";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchResultsList } from "@/features/email/inbox/components/search/search-results-list";
import { SearchSuggestionsList } from "@/features/email/inbox/components/search/search-suggestions-list";
import { useEmailInboxActions } from "@/features/email/inbox/hooks/use-email-inbox-actions";
import {
  fetchSearchEmails,
  fetchSearchSuggestions,
} from "@/features/email/inbox/queries";
import { useIntersectionObserver } from "@/hooks/use-intersection-observer";
import { useIsScrolled } from "@/hooks/use-is-scrolled";
import {
  useInfiniteQuery,
  useQuery,
} from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
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
  const routeQuery = search.q ?? "";

  const [query, setSearchQuery] = useState(routeQuery);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isScrolled = useIsScrolled(scrollRef);
  const { openEmail, executeEmailAction } = useEmailInboxActions({
    view: "inbox",
    mailboxId,
  });

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

  const resultsQuery = useInfiniteQuery({
    queryKey: emailQueryKeys.search.results(
      normalizeQuery(scope.q),
      scope.mailboxId,
      "inbox",
      scope.includeJunk ?? false,
    ),
    initialPageParam: "" as string,
    enabled: normalizeQuery(scope.q).length >= 2,
    initialData: initialResults
      ? {
          pages: [initialResults],
          pageParams: [""],
        }
      : undefined,
    queryFn: ({ pageParam }) =>
      fetchSearchEmails({
        ...scope,
        q: normalizeQuery(scope.q),
        cursor: pageParam || undefined,
      }),
    getNextPageParam: (lastPage) => lastPage?.cursor ?? undefined,
    staleTime: 30_000,
    gcTime: 60_000,
  });

  const suggestionsQuery = useQuery({
    queryKey: emailQueryKeys.search.suggestions(
      normalizeQuery(scope.q),
      scope.mailboxId,
      "inbox",
      scope.includeJunk ?? false,
    ),
    queryFn: () =>
      fetchSearchSuggestions({
        ...scope,
        q: normalizeQuery(scope.q),
      }),
    initialData: suggestions,
    staleTime: 30_000,
    gcTime: 60_000,
  });

  const results = useMemo(
    () => resultsQuery.data?.pages.flatMap((page) => page.emails) ?? [],
    [resultsQuery.data],
  );
  const suggestionData = suggestionsQuery.data ?? {
    filters: [],
    contacts: [],
    subjects: [],
  };
  const hasSearchSuggestions =
    suggestionData.filters.length > 0 ||
    (query.trim().length > 0 &&
      (suggestionData.contacts.length > 0 || suggestionData.subjects.length > 0));

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

  const canToggleJunk = true;
  const headerActions = (
    <>
      <div className="min-w-0 flex-1 sm:max-w-80">
        <Input
          className="h-8 text-sm"
          value={query}
          autoFocus
          onChange={(event) => handleQueryChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commitQuery(query);
            }
          }}
          placeholder="Search mail"
          spellCheck={false}
        />
      </div>
      {canToggleJunk ? (
        <Button
          type="button"
          variant={search.includeJunk ? "secondary" : "ghost"}
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
          {search.includeJunk ? "Hide junk" : "Show junk"}
        </Button>
      ) : null}
    </>
  );

  return (
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col">
      <PageHeader
        title={
          <span className="flex min-w-0 items-center gap-2">
            <span>Search</span>
          </span>
        }
        actions={headerActions}
        isScrolled={isScrolled}
      />

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        {hasSearchSuggestions ? (
          <div className="px-3 py-3 md:px-6">
            <SearchSuggestionsList
              query={query.trim()}
              suggestions={suggestionData}
              onSelectQuery={(nextQuery) => {
                commitQuery(nextQuery);
              }}
            />
          </div>
        ) : null}

        <SearchResultsList
          query={routeQuery.trim()}
          results={results}
          mailboxId={mailboxId}
          isPending={resultsQuery.isPending}
          hasNextPage={resultsQuery.hasNextPage ?? false}
          isFetchingNextPage={resultsQuery.isFetchingNextPage}
          loadMoreRef={loadMoreRef}
          onOpenEmail={openEmail}
          onAction={executeEmailAction}
        />
      </div>
    </div>
  );
}
