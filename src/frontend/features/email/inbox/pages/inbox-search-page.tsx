import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMailActions } from "@/features/email/mail/hooks/use-mail-actions";
import {
  fetchSearchEmails,
  fetchSearchSuggestions,
} from "@/features/email/mail/queries";
import { emailQueryKeys } from "@/features/email/mail/query-keys";
import { extractHighlightTerms } from "@/features/email/mail/search/highlight-terms";
import {
  parseSearchOperators,
  removeOperator,
} from "@/features/email/mail/search/parse-query-operators";
import {
  pushRecentSearch,
  readRecentSearches,
} from "@/features/email/mail/search/recent-searches";
import { SearchResultsList } from "@/features/email/mail/search/search-results-list";
import { SearchSuggestionsList } from "@/features/email/mail/search/search-suggestions-list";
import {
  MailboxPage,
  MailboxPageBody,
  MailboxPageHeader,
} from "@/features/email/shell/mailbox-page";
import { useHotkeys } from "@/hooks/use-hotkeys";
import { useIntersectionObserver } from "@/hooks/use-intersection-observer";
import { cn } from "@/lib/utils";
import { XIcon } from "@phosphor-icons/react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
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
  const routeQuery = search.q ?? "";

  const [query, setSearchQuery] = useState(routeQuery);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [recentSearches, setRecentSearches] = useState<string[]>(() =>
    readRecentSearches(),
  );
  const { openEmail, executeEmailAction } = useMailActions({
    view: "inbox",
    mailboxId,
  });

  useEffect(() => {
    setSearchQuery(routeQuery);
  }, [routeQuery]);

  useEffect(() => {
    setFocusedIndex(-1);
  }, [routeQuery]);

  const updateQuery = useDebouncedCallback((nextQuery: string) => {
    navigate({
      search: (prev) => ({
        ...prev,
        q: nextQuery.trim() || undefined,
      }),
      replace: true,
    });
  }, 120);

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
      (suggestionData.contacts.length > 0 ||
        suggestionData.subjects.length > 0));
  const showRecentSearches =
    !hasSearchSuggestions &&
    query.trim().length === 0 &&
    recentSearches.length > 0;

  const highlightTerms = useMemo(
    () => extractHighlightTerms(routeQuery),
    [routeQuery],
  );
  const activeOperators = useMemo(
    () => parseSearchOperators(routeQuery),
    [routeQuery],
  );

  const loadMoreRef = useIntersectionObserver<HTMLDivElement>({
    root: null,
    rootMargin: "1200px 0px",
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
    setRecentSearches(pushRecentSearch(nextQuery));
    navigate({
      search: (prev) => ({
        ...prev,
        q: nextQuery.trim() || undefined,
      }),
      replace: true,
    });
  }

  function openResultAt(index: number) {
    const email = results[index];
    if (!email) return;
    setRecentSearches(pushRecentSearch(routeQuery));
    openEmail(email);
  }

  function moveFocus(delta: 1 | -1) {
    if (results.length === 0) {
      setFocusedIndex(-1);
      return;
    }
    setFocusedIndex((current) => {
      if (current < 0) return delta > 0 ? 0 : results.length - 1;
      const next = current + delta;
      if (next < 0) return 0;
      if (next >= results.length) return results.length - 1;
      return next;
    });
  }

  function removeOperatorFromQuery(raw: string) {
    const next = removeOperator(routeQuery, raw);
    commitQuery(next);
  }

  useHotkeys({
    j: () => moveFocus(1),
    ArrowDown: { onKeyDown: () => moveFocus(1), allowInEditable: true },
    k: () => moveFocus(-1),
    ArrowUp: { onKeyDown: () => moveFocus(-1), allowInEditable: true },
  });

  const showSearchingIndicator =
    resultsQuery.isFetching && normalizeQuery(scope.q).length >= 2;

  const headerActions = (
    <>
      <span
        className={cn(
          "text-xs text-muted-foreground",
          showSearchingIndicator ? "visible" : "invisible",
        )}
        aria-live="polite"
        aria-hidden={!showSearchingIndicator}
      >
        Searching…
      </span>
      <Button
        type="button"
        variant={"secondary"}
        onClick={() =>
          navigate({
            search: (prev) => ({
              ...prev,
              includeJunk: prev.includeJunk ? undefined : true,
            }),
            replace: true,
          })
        }
        aria-pressed={search.includeJunk ?? false}
      >
        Junk {search.includeJunk ? "on" : "off"}
      </Button>
      <div className="min-w-40 flex-1 max-w-80">
        <Input
          className="h-7 text-xs"
          value={query}
          autoFocus
          onChange={(event) => handleQueryChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              if (focusedIndex >= 0 && results[focusedIndex]) {
                openResultAt(focusedIndex);
                return;
              }
              if (results.length > 0) {
                openResultAt(0);
                return;
              }
              commitQuery(query);
            }
          }}
          placeholder="Search mail"
          spellCheck={false}
        />
      </div>
    </>
  );

  return (
    <MailboxPage className="max-w-none">
      <MailboxPageHeader title="Search" actions={headerActions} />

      <MailboxPageBody className="overflow-y-auto">
        {activeOperators.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 px-3 py-2 md:px-4">
            {activeOperators.map((operator) => (
              <button
                key={operator.raw}
                type="button"
                onClick={() => removeOperatorFromQuery(operator.raw)}
                className="inline-flex items-center gap-1 border border-border/60 bg-muted/50 px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <span className="font-medium text-foreground/80">
                  {operator.key}:
                </span>
                <span className="truncate max-w-40">{operator.value}</span>
                <XIcon className="size-2.5" />
              </button>
            ))}
          </div>
        )}

        {hasSearchSuggestions && (
          <div className="px-3 py-3 md:px-4">
            <SearchSuggestionsList
              query={query.trim()}
              suggestions={suggestionData}
              onSelectQuery={(nextQuery) => {
                commitQuery(nextQuery);
              }}
            />
          </div>
        )}

        {showRecentSearches && (
          <div className="space-y-2 px-3 py-3 md:px-4">
            <p className="text-xs text-muted-foreground">Recent</p>
            <div className="flex flex-wrap gap-2">
              {recentSearches.map((entry) => (
                <Button
                  key={entry}
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => commitQuery(entry)}
                >
                  <span className="max-w-56 truncate">{entry}</span>
                </Button>
              ))}
            </div>
          </div>
        )}

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
          focusedIndex={focusedIndex}
          highlightTerms={highlightTerms}
        />
      </MailboxPageBody>
    </MailboxPage>
  );
}
