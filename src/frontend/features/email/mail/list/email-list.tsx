import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { useMailCompose } from "@/features/email/mail/compose/compose-context";
import { useMailViewData } from "@/features/email/mail/hooks/use-mail-view-data";
import type { MailAction } from "@/features/email/mail/hooks/use-mail-actions";
import { useMailHotkeys } from "@/features/email/mail/hooks/use-mail-hotkeys";
import type { ThreadIdentifier } from "@/features/email/mail/mutations";
import type { EmailListItem } from "@/features/email/mail/types";
import { fetchLabels } from "@/features/email/labels/queries";
import { labelQueryKeys } from "@/features/email/labels/query-keys";
import { useMailboxPageScrollState } from "@/features/email/shell/mailbox-scroll-state";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { getRouteApi, useNavigate } from "@tanstack/react-router";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useRef, useState } from "react";
import { DesktopEmailRow } from "./desktop-email-row";
import { MailFilterBar } from "./mail-filter-bar";
import { MobileEmailRow } from "./mobile-email-row";
import { TaskEmailRow } from "./task-email-row";

const mailboxRoute = getRouteApi("/_dashboard/$mailboxId");

const DESKTOP_ROW_HEIGHT = 40;
const MOBILE_ROW_HEIGHT = 56;
const TASK_ROW_HEIGHT = 56;

export function EmailList({
  emailData,
  onOpen,
  onAction,
  emptyTitle,
  emptyDescription,
  filterBarOpen,
  onFilterBarOpenChange,
  hideFilterControls = false,
  enableKeyboardNavigation = true,
  listVariant = "mail",
}: {
  emailData: ReturnType<typeof useMailViewData>;
  onOpen: (email: EmailListItem) => void;
  onAction: (
    action: MailAction,
    ids?: string[],
    thread?: ThreadIdentifier,
  ) => void;
  emptyTitle?: string;
  emptyDescription?: string;
  filterBarOpen?: boolean;
  onFilterBarOpenChange?: (open: boolean) => void;
  hideFilterControls?: boolean;
  enableKeyboardNavigation?: boolean;
  listVariant?: "mail" | "task";
}) {
  const {
    view,
    mailboxId,
    hasEmails,
    threadGroups,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    loadMoreRef,
    filters,
    setFilters,
    hasActiveFilters,
  } = emailData;
  const [showFilters, setShowFilters] = useState(false);
  const filterToggleOpen = filterBarOpen ?? showFilters;
  const setFilterToggleOpen = onFilterBarOpenChange ?? setShowFilters;
  const filterBarVisible = filterToggleOpen || hasActiveFilters;
  const { openCompose } = useMailCompose();
  const isMobile = useIsMobile();
  const { mailboxId: routeMailboxId } = mailboxRoute.useParams();
  const navigate = useNavigate();
  const rowHeight =
    listVariant === "task"
      ? TASK_ROW_HEIGHT
      : isMobile
        ? MOBILE_ROW_HEIGHT
        : DESKTOP_ROW_HEIGHT;

  const { data: allLabels } = useQuery({
    queryKey: labelQueryKeys.list(mailboxId),
    queryFn: () => fetchLabels(mailboxId),
    staleTime: 60_000,
  });

  const goToSearch = () =>
    navigate({
      to: "/$mailboxId/inbox/search",
      params: { mailboxId: routeMailboxId },
    });

  const { focusedIndex } = useMailHotkeys({
    groups: threadGroups,
    view,
    onOpen,
    onAction,
    onCompose: openCompose,
    onSearch: goToSearch,
    enabled: enableKeyboardNavigation,
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  useMailboxPageScrollState(scrollRef);

  const virtualizer = useVirtualizer({
    count: threadGroups.length,
    estimateSize: () => rowHeight,
    overscan: 10,
    getScrollElement: () => scrollRef.current,
  });

  useEffect(() => {
    virtualizer.measure();
  }, [rowHeight, virtualizer]);

  useEffect(() => {
    if (focusedIndex < 0) return;
    if (focusedIndex < threadGroups.length) {
      virtualizer.scrollToIndex(focusedIndex, { align: "auto" });
    }
  }, [focusedIndex, threadGroups.length, virtualizer]);

  const virtualItems = virtualizer.getVirtualItems();

  const showLoadMoreSentinel = hasNextPage || isFetchingNextPage;
  const loadMoreLabel = isFetchingNextPage
    ? "Loading more..."
    : "Scroll for more";
  const RowComponent =
    listVariant === "task"
      ? TaskEmailRow
      : isMobile
        ? MobileEmailRow
        : DesktopEmailRow;

  const showFilterControls = hasEmails || hasActiveFilters;

  return (
    <div className="flex w-full min-h-0 min-w-0 flex-1 flex-col">
      {showFilterControls && !hideFilterControls && (
        <div className="flex justify-end px-3 pt-1.5 md:px-6">
          <button
            type="button"
            onClick={() => setFilterToggleOpen(!filterToggleOpen)}
            className={cn(
              "rounded px-1.5 py-0.5 text-xs text-muted-foreground transition-colors hover:text-foreground",
              filterBarVisible && "text-foreground",
            )}
          >
            Filter
          </button>
        </div>
      )}

      {showFilterControls && !hideFilterControls && filterBarVisible && (
        <MailFilterBar filters={filters} onChange={setFilters} view={view} />
      )}

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        {hasEmails ? (
          <div
            className="relative w-full"
            style={{ height: virtualizer.getTotalSize() }}
          >
            {virtualItems.map((virtualItem) => {
              const group = threadGroups[virtualItem.index]!;

              return (
                <div
                  key={group.representative.id}
                  className="absolute left-0 w-full"
                  style={{
                    height: virtualItem.size,
                    transform: `translateY(${virtualItem.start}px)`,
                  }}
                >
                  <RowComponent
                    group={group}
                    view={view}
                    onOpen={onOpen}
                    onAction={onAction}
                    isFocused={virtualItem.index === focusedIndex}
                    allLabels={allLabels}
                  />
                </div>
              );
            })}
          </div>
        ) : isLoading ? (
          <Empty className="min-h-56 justify-center">
            <EmptyHeader>
              <EmptyTitle>Setting up your inbox…</EmptyTitle>
              <EmptyDescription>
                Fetching your messages. This only takes a moment.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <Empty className="min-h-56 justify-center">
            <EmptyHeader>
              <EmptyTitle>{emptyTitle ?? "No emails"}</EmptyTitle>
              <EmptyDescription>
                {emptyDescription ??
                  "Messages that belong to this view will show up here."}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}

        {showLoadMoreSentinel && (
          <div
            ref={loadMoreRef}
            className="p-6 text-center text-xs text-muted-foreground"
          >
            {loadMoreLabel}
          </div>
        )}
      </div>
    </div>
  );
}
