import {
 Empty,
 EmptyDescription,
 EmptyHeader,
 EmptyTitle,
} from "@/components/ui/empty";
import type { MailAction } from "@/features/email/mail/shared/hooks/use-mail-actions";
import type { ThreadIdentifier } from "@/features/email/mail/shared/mutations";
import type { EmailListItem } from "@/features/email/mail/shared/types";
import { groupEmailsByThread } from "@/features/email/mail/thread/group-emails-by-thread";
import { useIsMobile } from "@/hooks/use-mobile";
import type { RefCallback } from "react";
import { useEffect, useMemo, useRef } from "react";
import { BlankEmailRow } from "@/features/email/mail/list/blank-email-row";
import { MobileEmailRow } from "@/features/email/mail/list/mobile-email-row";
import { SearchEmailRow } from "@/features/email/mail/list/search-email-row";

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
 focusedIndex = -1,
 highlightTerms = [],
}: {
 query: string;
 results: EmailListItem[];
 mailboxId: number;
 isPending: boolean;
 hasNextPage: boolean;
 isFetchingNextPage: boolean;
 loadMoreRef: RefCallback<HTMLDivElement>;
 onOpenEmail: (email: EmailListItem) => void;
 onAction: (
 action: MailAction,
 ids?: string[],
 thread?: ThreadIdentifier,
 ) => void;
 focusedIndex?: number;
 highlightTerms?: string[];
}) {
 void mailboxId;
 const isMobile = useIsMobile();
 const RowComponent = isMobile ? MobileEmailRow : SearchEmailRow;
 const groups = useMemo(() => groupEmailsByThread(results), [results]);
 const containerRef = useRef<HTMLDivElement>(null);

 useEffect(() => {
 if (focusedIndex < 0 || !containerRef.current) return;
 const target = containerRef.current.querySelector<HTMLElement>(
 `[data-search-row-index="${focusedIndex}"]`,
 );
 target?.scrollIntoView({ block: "nearest", behavior: "auto" });
 }, [focusedIndex]);

if (query.length < 2) {
  return (
  <Empty className="border-0 p-0">
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
  <div className="w-full">
  {Array.from({ length: 12 }).map((_, i) => (
  <div key={i} className={isMobile ? undefined : "h-[3.75rem]"}>
  <BlankEmailRow isMobile={isMobile} />
  </div>
  ))}
  </div>
  );
  }

  if (groups.length === 0) {
  return (
  <Empty className="border-0 p-0">
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
 <div ref={containerRef} className="w-full">
 {groups.map((group, index) => (
 <div
 key={group.representative.id}
 data-search-row-index={index}
 className={isMobile ? undefined : "h-[3.75rem]"}
 >
 <RowComponent
 group={group}
 view="inbox"
 onOpen={onOpenEmail}
 onAction={onAction}
 isFocused={index === focusedIndex}
 highlightTerms={highlightTerms}
 searchQuery={query}
 />
 </div>
 ))}

 {(hasNextPage || isFetchingNextPage) && (
 <div
 ref={loadMoreRef}
 aria-hidden="true"
 className={isFetchingNextPage ? "h-8 w-full" : "h-px w-full"}
 />
 )}
 </div>
 );
}
