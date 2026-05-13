import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { useMailCompose } from "@/features/email/mail/compose/compose-context";
import type { MailAction } from "@/features/email/mail/hooks/use-mail-actions";
import { useMailHotkeys } from "@/features/email/mail/hooks/use-mail-hotkeys";
import { useMailViewData } from "@/features/email/mail/hooks/use-mail-view-data";
import type { ThreadIdentifier } from "@/features/email/mail/mutations";
import type { EmailListItem } from "@/features/email/mail/types";
import type { ThreadGroup } from "@/features/email/mail/utils/group-emails-by-thread";
import { useMailboxPageScrollState } from "@/features/email/shell/mailbox-scroll-state";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { ArrowClockwiseIcon, SpinnerGapIcon } from "@phosphor-icons/react";
import { getRouteApi, useNavigate } from "@tanstack/react-router";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { MailFilterBar } from "./mail-filter-bar";
import { MobileEmailRow } from "./mobile-email-row";
import { SplitEmailRow } from "./split-email-row";
import { TaskEmailRow } from "./task-email-row";
import { useMailListVirtualization } from "./use-mail-list-virtualization";
import { useMobilePullToRefresh } from "./use-mobile-pull-to-refresh";

const mailboxRoute = getRouteApi("/_dashboard/$mailboxId");

const MOBILE_ROW_HEIGHT = 88;
const DESKTOP_ROW_HEIGHT = 84;
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
  selectedEmailId,
  onSnooze,
}: {
  emailData: ReturnType<typeof useMailViewData>;
  onOpen: (email: EmailListItem) => void;
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
  listVariant?: "mail" | "task";
  selectedEmailId?: string | null;
}) {
  const {
    view,
    hasEmails,
    threadGroups,
    hasNextPage,
    isFetchingNextPage,
    isInitialPagePending,
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
  const rowHeight =
    listVariant === "task"
      ? TASK_ROW_HEIGHT
      : isMobile
        ? MOBILE_ROW_HEIGHT
        : DESKTOP_ROW_HEIGHT;

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
    onRefresh: () => void emailData.refreshViewAsync(),
    enabled: enableKeyboardNavigation,
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

  const { virtualizer, virtualItems, virtualCount } =
    useMailListVirtualization({
      scrollRef,
      rowHeight,
      loadedCount: threadGroups.length,
      isInitialPagePending,
      hasNextPage,
      isFetching,
      isFetchingNextPage,
      fetchNextPage,
    });

  const rowRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  useLayoutEffect(() => {
    if (focusedIndex < 0) return;
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

  const showLoadMoreSentinel = hasNextPage || isFetchingNextPage;
  const pullIndicatorVisible =
    pullToRefresh.pullDistance > 2 || pullToRefresh.isRefreshing;

  const RowComponent = getRowComponent({
    listVariant,
    isMobile,
  });

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
                        onAction={onAction}
                        onSnooze={onSnooze}
                        isFocused={virtualItem.index === focusedIndex}
                        isSelected={group.emails.some(
                          (email) => email.id === selectedEmailId,
                        )}
                      />
                    ) : (
                      <BlankEmailRow
                        listVariant={listVariant}
                        isMobile={isMobile}
                      />
                    )}
                  </div>
                );
              })}
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

function BlankEmailRow({
  listVariant,
  isMobile,
}: {
  listVariant: "mail" | "task";
  isMobile: boolean;
}) {
  if (listVariant === "task") {
    return (
      <div
        aria-hidden="true"
        className="mx-3 my-1 h-12 border border-border/30 bg-card/20 md:mx-6"
      />
    );
  }

  return (
    <div
      aria-hidden="true"
      className={cn(
        "h-full w-full border-b border-border/40 bg-background",
        isMobile && "px-3 py-2",
      )}
    />
  );
}

function getRowComponent({
  listVariant,
  isMobile,
}: {
  listVariant: "mail" | "task";
  isMobile: boolean;
}) {
  if (listVariant === "task") return TaskEmailRow;
  if (isMobile) return MobileEmailRow;
  return SplitEmailRow;
}
