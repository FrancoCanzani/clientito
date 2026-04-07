import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import type { EmailListItem } from "@/features/email/inbox/types";
import { cn } from "@/lib/utils";
import { PaperclipIcon, StarIcon } from "@phosphor-icons/react";
import { format, isThisYear, isToday } from "date-fns";
import type { RefCallback } from "react";

function formatSearchDate(timestamp: number) {
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
  const isStarred = email.labelIds.includes("STARRED");
  const participantLabel =
    email.direction === "sent"
      ? email.toAddr
        ? `To: ${email.toAddr}`
        : "To: (unknown recipient)"
      : email.fromName || email.fromAddr;

  return (
    <button
      type="button"
      onClick={onSelect}
      className="group flex w-full cursor-default items-center gap-2 rounded-md px-2 py-2 text-left transition-[opacity,background-color] duration-200 ease-out hover:bg-muted/40"
    >
      <span
        className={cn(
          "size-1.5 shrink-0 rounded-full",
          email.isRead ? "hidden" : "bg-blue-500",
        )}
      />

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2 overflow-hidden">
          <span className="min-w-0 max-w-[15rem] shrink truncate text-sm font-medium tracking-[-0.6px] text-foreground">
            {participantLabel}
          </span>
          <span className="min-w-0 flex-1 truncate text-sm tracking-[-0.2px] text-foreground/50">
            {email.subject ?? "(no subject)"}
          </span>
        </div>
        {email.snippet && (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {email.snippet}
          </p>
        )}
      </div>

      <div className="shrink-0">
        <div className="relative flex min-w-20 justify-end text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            {isStarred && (
              <StarIcon
                className="size-3 text-yellow-500"
                weight="fill"
                aria-hidden
              />
            )}
            {email.hasAttachment && (
              <PaperclipIcon className="size-3" aria-hidden />
            )}
            <span>{formatSearchDate(email.date)}</span>
          </div>
        </div>
      </div>
    </button>
  );
}

export function SearchResultsList({
  query,
  results,
  isPending,
  hasNextPage,
  isFetchingNextPage,
  loadMoreRef,
  onOpenEmail,
}: {
  query: string;
  results: EmailListItem[];
  isPending: boolean;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  loadMoreRef: RefCallback<HTMLDivElement>;
  onOpenEmail: (email: EmailListItem) => void;
}) {
  if (query.length < 2) {
    return (
      <Empty className="h-full min-h-full flex-1 justify-center border-0 p-0">
        <EmptyHeader>
          <EmptyTitle>Search your inbox</EmptyTitle>
          <EmptyDescription>
            Start with at least two characters, or pick a suggestion below.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  if (isPending) {
    return (
      <Empty className="h-full min-h-full flex-1 justify-center border-0 p-0">
        <EmptyHeader>
          <EmptyTitle>Searching</EmptyTitle>
          <EmptyDescription>
            {`Finding the best matches for "${query}".`}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  if (results.length === 0) {
    return (
      <Empty className="h-full min-h-full flex-1 justify-center border-0 p-0">
        <EmptyHeader>
          <EmptyTitle>No results</EmptyTitle>
          <EmptyDescription>
            Try a different term, or narrow it with `from:`, `subject:`, or
            `is:unread`.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="space-y-1.5">
      {results.map((email) => (
        <SearchResultRow
          key={email.id}
          email={email}
          onSelect={() => onOpenEmail(email)}
        />
      ))}

      {hasNextPage && (
        <div
          ref={loadMoreRef}
          className="pt-2 text-center text-xs text-muted-foreground"
        >
          {isFetchingNextPage ? "Loading more…" : "Scroll for more results"}
        </div>
      )}
    </div>
  );
}
