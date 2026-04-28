import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import type { EmailInboxAction } from "@/features/email/inbox/hooks/use-email-inbox-actions";
import type { EmailListItem } from "@/features/email/inbox/types";
import { groupEmailsByThread } from "@/features/email/inbox/utils/group-emails-by-thread";
import { fetchLabels } from "@/features/email/labels/queries";
import { labelQueryKeys } from "@/features/email/labels/query-keys";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import type { RefCallback } from "react";
import { DesktopEmailRow } from "../list/desktop-email-row";
import { MobileEmailRow } from "../list/mobile-email-row";

export function SearchResultsList({
  query,
  results,
  mailboxId,
  isPending,
  hasNextPage,
  isFetchingNextPage,
  loadMoreRef,
  onOpenEmail,
  onAction,
}: {
  query: string;
  results: EmailListItem[];
  mailboxId: number;
  isPending: boolean;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  loadMoreRef: RefCallback<HTMLDivElement>;
  onOpenEmail: (email: EmailListItem) => void;
  onAction: (action: EmailInboxAction, ids?: string[]) => void;
}) {
  const isMobile = useIsMobile();
  const RowComponent = isMobile ? MobileEmailRow : DesktopEmailRow;
  const groups = useMemo(() => groupEmailsByThread(results), [results]);
  const { data: allLabels } = useQuery({
    queryKey: labelQueryKeys.list(mailboxId),
    queryFn: () => fetchLabels(mailboxId),
    staleTime: 60_000,
  });

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
      <div className="w-full" aria-label={`Searching for ${query}`}>
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className={cn(
              "flex w-full items-center gap-3",
              isMobile
                ? "h-14 border-b border-border/40 px-4"
                : "h-10 rounded-md px-6",
            )}
          >
            <Skeleton className="h-3.5 w-24 shrink-0 sm:w-32 lg:w-44" />
            <Skeleton className="h-3.5 min-w-0 flex-1" />
            <Skeleton className="h-3 w-14 shrink-0" />
          </div>
        ))}
      </div>
    );
  }

  if (groups.length === 0) {
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
    <div className="w-full">
      {groups.map((group) => (
        <RowComponent
          key={group.representative.id}
          group={group}
          view="inbox"
          onOpen={onOpenEmail}
          onAction={onAction}
          allLabels={allLabels}
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
