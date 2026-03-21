import { fetchEmails } from "@/features/inbox/queries";
import type { EmailListItem } from "@/features/inbox/types";
import { useIntersectionObserver } from "@/hooks/use-intersection-observer";
import { cn } from "@/lib/utils";
import { CircleNotchIcon, MagnifyingGlassIcon } from "@phosphor-icons/react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { format, isThisYear, isToday } from "date-fns";
import { useMemo } from "react";
import { useDebounce } from "use-debounce";

const PAGE_SIZE = 20;

function formatSearchDate(timestamp: number): string {
  const date = new Date(timestamp);
  if (isToday(date)) return format(date, "p");
  if (isThisYear(date)) return format(date, "MMM d");
  return format(date, "MMM d, yyyy");
}

function SearchResultRow({
  email,
  onSelect,
}: {
  email: EmailListItem;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-muted/50"
      onClick={onSelect}
    >
      <span
        className={cn(
          "size-1.5 shrink-0 rounded-full",
          email.isRead ? "bg-transparent" : "bg-blue-500",
        )}
      />
      <div className="min-w-0 flex-1 overflow-hidden">
        <div className="flex items-center gap-2">
          <span className="shrink-0 truncate font-medium sm:max-w-52">
            {email.fromName || email.fromAddr}
          </span>
          <span className="truncate text-muted-foreground">
            {email.subject ?? "(no subject)"}
          </span>
        </div>
        {email.snippet && (
          <p className="truncate text-xs text-muted-foreground">
            {email.snippet}
          </p>
        )}
      </div>
      <span className="shrink-0 font-mono text-xs text-muted-foreground">
        {formatSearchDate(email.date)}
      </span>
    </button>
  );
}

export function SearchPanel({
  searchInput,
  setSearchInput,
  searchInputRef,
  close,
  mailboxId,
}: {
  searchInput: string;
  setSearchInput: (value: string) => void;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  close: () => void;
  mailboxId?: number;
}) {
  const navigate = useNavigate();
  const [debouncedSearch] = useDebounce(searchInput, 300);
  const hasQuery = debouncedSearch.trim().length > 0;

  const {
    data,
    isPending,
    isFetching,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useInfiniteQuery({
    queryKey: ["emails", "search", debouncedSearch, mailboxId ?? "all"],
    queryFn: ({ pageParam }) =>
      fetchEmails({ search: debouncedSearch, limit: PAGE_SIZE, offset: pageParam, mailboxId }),
    initialPageParam: 0,
    getNextPageParam: (lastPage) =>
      lastPage?.pagination?.hasMore
        ? lastPage.pagination.offset + lastPage.pagination.limit
        : undefined,
    enabled: hasQuery,
  });

  const results = useMemo(
    () => data?.pages.flatMap((page) => page.data) ?? [],
    [data],
  );

  const loadMoreRef = useIntersectionObserver<HTMLDivElement>({
    root: null,
    rootMargin: "100px 0px",
    threshold: 0.01,
    onChange: (isIntersecting) => {
      if (!isIntersecting || !hasNextPage || isFetchingNextPage || isFetching)
        return;
      void fetchNextPage();
    },
  });

  const showInitialSpinner = isPending && isFetching && hasQuery;

  function openEmail(email: EmailListItem) {
    navigate({
      to: "/inbox/$id",
      params: { id: "all" },
      search: { id: email.id },
    });
    close();
  }

  return (
    <div className="flex max-h-72 flex-col">
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <MagnifyingGlassIcon className="size-4 shrink-0 text-muted-foreground" />
        <input
          ref={searchInputRef}
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search emails..."
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          autoFocus
        />
        {(showInitialSpinner || isFetchingNextPage) && (
          <CircleNotchIcon className="size-4 animate-spin text-muted-foreground" />
        )}
      </div>

      <div className="overflow-y-auto">
        {!hasQuery ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">
            Type to search your emails
          </p>
        ) : showInitialSpinner ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">
            Searching...
          </p>
        ) : results.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">
            No results found
          </p>
        ) : (
          <div className="py-1">
            {results.map((email) => (
              <SearchResultRow
                key={email.id}
                email={email}
                onSelect={() => openEmail(email)}
              />
            ))}
            {hasNextPage && (
              <div
                ref={loadMoreRef}
                className="py-2 text-center text-xs text-muted-foreground"
              >
                {isFetchingNextPage ? "Loading more..." : "Scroll for more"}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
