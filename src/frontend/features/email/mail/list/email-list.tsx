import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { useMailCompose } from "@/features/email/mail/compose/compose-context";
import { BlankEmailRow } from "@/features/email/mail/list/blank-email-row";
import { MailFilterBar } from "@/features/email/mail/list/mail-filter-bar";
import { MobileEmailRow } from "@/features/email/mail/list/mobile-email-row";
import { SplitEmailRow } from "@/features/email/mail/list/split-email-row";
import { useMailListVirtualization } from "@/features/email/mail/list/use-mail-list-virtualization";
import { useMobilePullToRefresh } from "@/features/email/mail/list/use-mobile-pull-to-refresh";
import type { MailAction } from "@/features/email/mail/shared/hooks/use-mail-actions";
import { useMailHotkeys } from "@/features/email/mail/shared/hooks/use-mail-hotkeys";
import { useMailViewData } from "@/features/email/mail/shared/hooks/use-mail-view-data";
import type { ThreadIdentifier } from "@/features/email/mail/shared/mutations";
import type { EmailListItem } from "@/features/email/mail/shared/types";
import type { ThreadGroup } from "@/features/email/mail/thread/group-emails-by-thread";
import { useMailboxPageScrollState } from "@/features/email/shell/mailbox-scroll-state";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { ArrowClockwiseIcon, SpinnerGapIcon } from "@phosphor-icons/react";
import { getRouteApi, useNavigate } from "@tanstack/react-router";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

const mailboxRoute = getRouteApi("/_dashboard/$mailboxId");

const MOBILE_ROW_HEIGHT = 88;
const DESKTOP_ROW_HEIGHT = 84;

export function EmailList({
  emailData,
  onOpen,
  onOpenInTab,
  onAction,
  emptyTitle,
  emptyDescription,
  filterBarOpen,
  onFilterBarOpenChange,
  hideFilterControls = false,
  enableKeyboardNavigation = true,
  selectedEmailId,
  onSnooze,
  onNextTab,
  onPrevTab,
  onCloseTab,
  canSwitchTab,
  canCloseTab,
}: {
  emailData: ReturnType<typeof useMailViewData>;
  onOpen: (email: EmailListItem) => void;
  onOpenInTab?: (email: EmailListItem) => void;
  onAction: (
    action: MailAction,
    ids?: string[],
    thread?: ThreadIdentifier,
  ) => void;
  onSnooze?: (group: ThreadGroup, timestamp: number | null) => void;
  emptyTitle?: string;
  emptyDescription?: string;
  filterBarOpen?: boolean;
  onFilterBarOpenChange?: (open: boolean) => void;
  hideFilterControls?: boolean;
  enableKeyboardNavigation?: boolean;
  selectedEmailId?: string | null;
  onNextTab?: () => void;
  onPrevTab?: () => void;
  onCloseTab?: () => void;
  canSwitchTab?: boolean;
  canCloseTab?: boolean;
}) {
  const {
    view,
    hasEmails,
    threadGroups,
    hasNextPage,
    isFetchingNextPage,
    isInitialViewPending,
    showEmptyState,
    isFetching,
    fetchNextPage,
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
  const rowHeight = isMobile ? MOBILE_ROW_HEIGHT : DESKTOP_ROW_HEIGHT;

  const goToSearch = () =>
    navigate({
      to: "/$mailboxId/inbox/search",
      params: { mailboxId: routeMailboxId },
    });

  const { focusedIndex, setFocusedId, userMovedFocusRef } = useMailHotkeys({
    groups: threadGroups,
    view,
    onOpen,
    onOpenInTab,
    onAction,
    onCompose: openCompose,
    onSearch: goToSearch,
    onRefresh: () => void emailData.refreshViewAsync(),
    onNextTab,
    onPrevTab,
    onCloseTab,
    canSwitchTab,
    canCloseTab,
    enabled: enableKeyboardNavigation && !emailData.isPlaceholderData,
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  useMailboxPageScrollState(scrollRef);
  const pullToRefresh = useMobilePullToRefresh({
    containerRef: scrollRef,
    enabled: isMobile,
    onRefresh: async () => {
      await emailData.refreshViewAsync();
    },
  });

  const { virtualizer, virtualItems, virtualCount } = useMailListVirtualization(
    {
      scrollRef,
      rowHeight,
      loadedCount: threadGroups.length,
      hasNextPage,
      isFetching,
      isFetchingNextPage,
      fetchNextPage,
    },
  );

  const rowRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  useLayoutEffect(() => {
    if (focusedIndex < 0) return;
    const userInitiated = userMovedFocusRef.current;
    userMovedFocusRef.current = false;

    const listEl = scrollRef.current;
    const listHasFocus = !!(
      listEl &&
      typeof document !== "undefined" &&
      document.activeElement instanceof Node &&
      listEl.contains(document.activeElement)
    );

    // Only steal DOM focus / scroll the list when the user is actively driving
    // it. Tab switches, data loads, and reader close should update the visible
    // highlight silently without yanking focus from search inputs, the reader,
    // or wherever the user actually is.
    if (!userInitiated && !listHasFocus) return;

    const el = rowRefs.current.get(focusedIndex);
    if (el) {
      el.focus({ preventScroll: true });
    }
    if (focusedIndex < threadGroups.length) {
      virtualizer.scrollToIndex(focusedIndex, { align: "auto" });
    }
    // threadGroups.length and virtualizer are intentionally omitted: we only want
    // to scroll when the user explicitly changes focus (keyboard nav), not when
    // data appends. virtualizer is omitted because its identity changes every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusedIndex]);

  // Keep the list's logical focus pinned to the email currently open in the
  // reader, so closing the reader leaves the highlight on that row instead of
  // snapping back to row 0.
  useEffect(() => {
    if (!selectedEmailId) return;
    const group = threadGroups.find((g) =>
      g.emails.some((email) => email.id === selectedEmailId),
    );
    if (!group) return;
    setFocusedId(group.representative.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEmailId, threadGroups]);

  useEffect(() => {
    if (!selectedEmailId) return;
    const idx = threadGroups.findIndex((g) =>
      g.emails.some((email) => email.id === selectedEmailId),
    );
    if (idx >= 0) {
      virtualizer.scrollToIndex(idx, { align: "auto" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEmailId]);

  const didResetScrollRef = useRef(false);
  useEffect(() => {
    if (didResetScrollRef.current) return;
    if (threadGroups.length === 0) return;
    didResetScrollRef.current = true;
    virtualizer.scrollToIndex(0, { align: "start" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadGroups.length]);

  const showLoadMoreSentinel = hasNextPage || isFetchingNextPage;
  const pullIndicatorVisible =
    pullToRefresh.pullDistance > 2 || pullToRefresh.isRefreshing;

  const RowComponent = getRowComponent({ isMobile });

  const showFilterControls = hasEmails || hasActiveFilters;

  return (
    <div className="flex w-full min-h-0 min-w-0 flex-1 flex-col">
      {showFilterControls && !hideFilterControls && (
        <div className="flex justify-end px-3 pt-1.5 md:px-6">
          <button
            type="button"
            onClick={() => setFilterToggleOpen(!filterToggleOpen)}
            className={cn(
              " px-1.5 py-0.5 text-xs text-muted-foreground transition-colors hover:text-foreground",
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

      <div
        ref={scrollRef}
        className="relative min-h-0 flex-1 overflow-y-auto overscroll-y-contain"
      >
        {isMobile && (
          <div className="pointer-events-none sticky top-0 z-10 flex h-0 justify-center overflow-visible">
            <div
              className="flex size-7 items-center justify-center rounded-full border border-border/60 bg-background/95 text-muted-foreground shadow-xs transition-all"
              style={{
                opacity: pullIndicatorVisible ? 1 : 0,
                transform: `translateY(${Math.max(0, pullToRefresh.pullDistance - 22)}px)`,
              }}
              aria-label={
                pullToRefresh.isRefreshing ? "Refreshing" : "Pull to refresh"
              }
            >
              {pullToRefresh.isRefreshing ? (
                <SpinnerGapIcon className="size-3.5 animate-spin" />
              ) : (
                <ArrowClockwiseIcon
                  className="size-3.5 transition-colors"
                  style={{
                    transform: `rotate(${pullToRefresh.pullDistance * 3}deg)`,
                  }}
                />
              )}
            </div>
          </div>
        )}
        <div
          style={{
            transform: `translateY(${pullToRefresh.pullDistance}px)`,
            transition:
              pullToRefresh.isRefreshing || pullToRefresh.pullDistance === 0
                ? "transform 180ms ease"
                : undefined,
          }}
        >
          {virtualCount > 0 ? (
            <div
              className="relative w-full"
              style={{ height: virtualizer.getTotalSize() }}
            >
              {focusedIndex >= 0 && focusedIndex < threadGroups.length && (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute left-0 z-0 w-full transition-transform duration-150 ease-out motion-reduce:transition-none"
                  style={{
                    height: rowHeight,
                    transform: `translateY(${focusedIndex * rowHeight}px)`,
                  }}
                />
              )}
              {virtualItems.map((virtualItem) => {
                const group = threadGroups[virtualItem.index];
                const key =
                  group?.representative.id ?? `blank-${virtualItem.index}`;

                return (
                  <div
                    key={key}
                    ref={(el) => {
                      if (el && group) {
                        rowRefs.current.set(virtualItem.index, el);
                      } else {
                        rowRefs.current.delete(virtualItem.index);
                      }
                    }}
                    onMouseDownCapture={() => {
                      if (!group) return;
                      userMovedFocusRef.current = true;
                      setFocusedId(group.representative.id);
                    }}
                    onClickCapture={(e) => {
                      if (!group || !onOpenInTab) return;
                      if (e.metaKey || e.ctrlKey) {
                        e.preventDefault();
                        e.stopPropagation();
                        onOpenInTab(group.representative);
                      }
                    }}
                    onAuxClick={(e) => {
                      if (!group || !onOpenInTab) return;
                      if (e.button === 1) {
                        e.preventDefault();
                        onOpenInTab(group.representative);
                      }
                    }}
                    className="absolute left-0 w-full"
                    style={{
                      height: virtualItem.size,
                      transform: `translateY(${virtualItem.start}px)`,
                    }}
                  >
                    {group ? (
                      <RowComponent
                        group={group}
                        view={view}
                        onOpen={onOpen}
                        onOpenInTab={onOpenInTab}
                        onAction={onAction}
                        onSnooze={onSnooze}
                        isFocused={virtualItem.index === focusedIndex}
                        isSelected={group.emails.some(
                          (email) => email.id === selectedEmailId,
                        )}
                      />
                    ) : (
                      <BlankEmailRow isMobile={isMobile} />
                    )}
                  </div>
                );
              })}
            </div>
          ) : isInitialViewPending ? (
            <div className="relative w-full">
              {Array.from({ length: 15 }).map((_, i) => (
                <div key={`init-skel-${i}`} style={{ height: rowHeight }}>
                  <BlankEmailRow isMobile={isMobile} />
                </div>
              ))}
            </div>
          ) : showEmptyState ? (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>{emptyTitle ?? "No emails"}</EmptyTitle>
                <EmptyDescription>
                  {emptyDescription ??
                    "Messages that belong to this view will show up here."}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : null}

          {showLoadMoreSentinel && (
            <div
              ref={loadMoreRef}
              aria-hidden="true"
              className={cn("h-px w-full", isFetchingNextPage && "h-8")}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function getRowComponent({
  isMobile,
}: {
  isMobile: boolean;
}) {
  if (isMobile) return MobileEmailRow;
  return SplitEmailRow;
}
