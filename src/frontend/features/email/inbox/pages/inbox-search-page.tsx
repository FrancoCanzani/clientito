import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  fetchSearchEmails,
  fetchSearchSuggestions,
} from "@/features/email/mail/shared/data/search";
import { useMailActions } from "@/features/email/mail/shared/hooks/use-mail-actions";
import { emailQueryKeys } from "@/features/email/mail/shared/query-keys";
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
import { useIntersectionObserver } from "@/hooks/use-intersection-observer";
import { useShortcuts } from "@/hooks/use-shortcuts";
import { XIcon } from "@phosphor-icons/react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useDebouncedCallback } from "use-debounce";

const searchRoute = getRouteApi("/_dashboard/$mailboxId/inbox/search");

function normalizeQuery(query: string) {
  return query.trim().replace(/\s+/g, " ");
}

const SEARCH_INSERTIONS = [
  { label: "From", value: "from:" },
  { label: "To", value: "to:" },
  { label: "Cc", value: "cc:" },
  { label: "Subject", value: "subject:" },
  { label: "After", value: "after:" },
  { label: "Before", value: "before:" },
] as const;

const SEARCH_FILTERS = [
  { label: "Has attachment", value: "has:attachment" },
  { label: "Unread", value: "is:unread" },
  { label: "Starred", value: "is:starred" },
  { label: "Sent", value: "is:sent" },
] as const;

export default function InboxSearchPage() {
  const { mailboxId } = searchRoute.useParams();
  const { suggestions, initialResults } = searchRoute.useLoaderData();
  const search = searchRoute.useSearch();
  const navigate = searchRoute.useNavigate();
  const routeQuery = search.q ?? "";

  const [query, setSearchQuery] = useState(routeQuery);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [searchTokenMenuKey, setSearchTokenMenuKey] = useState(0);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [loadMoreVisible, setLoadMoreVisible] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>(() =>
    readRecentSearches(),
  );
  const searchInputRef = useRef<HTMLInputElement>(null);
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
    initialPageParam: "",
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
  const {
    hasNextPage: hasMoreSearchResults,
    isFetching: isFetchingSearchResults,
    isFetchingNextPage: isFetchingNextSearchPage,
    fetchNextPage: fetchNextSearchPage,
  } = resultsQuery;
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
  const showSearchSuggestions = isSearchFocused && hasSearchSuggestions;
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
      setLoadMoreVisible(isIntersecting);
    },
  });

  useEffect(() => {
    if (!loadMoreVisible) return;
    if (!hasMoreSearchResults) return;
    if (isFetchingSearchResults || isFetchingNextSearchPage) return;

    void fetchNextSearchPage();
  }, [
    fetchNextSearchPage,
    hasMoreSearchResults,
    isFetchingSearchResults,
    isFetchingNextSearchPage,
    loadMoreVisible,
  ]);

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

  function appendSearchToken(token: string) {
    const next = [query.trim(), token].filter(Boolean).join(" ");
    handleQueryChange(next);
    setSearchTokenMenuKey((current) => current + 1);
    requestAnimationFrame(() => {
      const input = searchInputRef.current;
      if (!input) return;
      input.focus();
      input.setSelectionRange(next.length, next.length);
    });
  }

  useShortcuts("search", {
    "search:next": () => moveFocus(1),
    "search:prev": () => moveFocus(-1),
    "search:next-arrow": () => moveFocus(1),
    "search:prev-arrow": () => moveFocus(-1),
    "action:esc": () => {
      void navigate({ to: "/$mailboxId/inbox", params: { mailboxId } });
    },
  });

  const headerActions = (
    <>
      <Button
        type="button"
        variant="secondary"
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
      <Select key={searchTokenMenuKey} onValueChange={appendSearchToken}>
        <SelectTrigger size="sm" className="h-7">
          <SelectValue placeholder="Add" />
        </SelectTrigger>
        <SelectContent align="end">
          <SelectGroup>
            <SelectLabel>Fields</SelectLabel>
            {SEARCH_INSERTIONS.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectGroup>
          <SelectGroup>
            <SelectLabel>Filters</SelectLabel>
            {SEARCH_FILTERS.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      <div className="relative min-w-40 max-w-80 flex-1">
        <Input
          ref={searchInputRef}
          className="h-7 text-xs"
          value={query}
          autoFocus
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={showSearchSuggestions}
          onFocus={() => setIsSearchFocused(true)}
          onBlur={() => setIsSearchFocused(false)}
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
        {showSearchSuggestions && (
          <div
            className="absolute inset-x-0 top-[calc(100%+0.375rem)] z-20"
            onMouseDown={(event) => event.preventDefault()}
          >
            <SearchSuggestionsList
              query={query.trim()}
              suggestions={suggestionData}
              onSelectQuery={(nextQuery) => {
                commitQuery(nextQuery);
                setIsSearchFocused(false);
              }}
            />
          </div>
        )}
      </div>
    </>
  );

  return (
    <MailboxPage className="max-w-none">
      <MailboxPageHeader title="Search" actions={headerActions} />

      <MailboxPageBody>
        <div className="relative min-h-0 flex-1 overflow-y-auto">
          {activeOperators.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 px-3 py-2 md:px-4">
              {activeOperators.map((operator) => (
                <button
                  key={operator.raw}
                  type="button"
                  onClick={() => removeOperatorFromQuery(operator.raw)}
                  className="inline-flex items-center gap-1 border border-border/40 bg-muted/50 px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <span className="font-medium text-foreground/80">
                    {operator.key}:
                  </span>
                  <span className="max-w-40 truncate">{operator.value}</span>
                  <XIcon className="size-2.5" />
                </button>
              ))}
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
        </div>
      </MailboxPageBody>
    </MailboxPage>
  );
}
