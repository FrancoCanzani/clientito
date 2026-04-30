import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { IconButton } from "@/components/ui/icon-button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useGatekeeperPending } from "@/features/email/gatekeeper/queries";
import { useInboxCompose } from "@/features/email/inbox/components/compose/inbox-compose-provider";
import { useEmailData } from "@/features/email/inbox/hooks/use-email-data";
import type { EmailInboxAction } from "@/features/email/inbox/hooks/use-email-inbox-actions";
import type { ThreadIdentifier } from "@/features/email/inbox/mutations";
import { useInboxHotkeys } from "@/features/email/inbox/hooks/use-inbox-hotkeys";
import type { EmailListItem } from "@/features/email/inbox/types";
import { VIEW_LABELS } from "@/features/email/inbox/utils/inbox-filters";
import { fetchLabels } from "@/features/email/labels/queries";
import { labelQueryKeys } from "@/features/email/labels/query-keys";
import { useIsScrolled } from "@/hooks/use-is-scrolled";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { FunnelSimpleIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { getRouteApi, Link, useNavigate } from "@tanstack/react-router";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useRef, useState } from "react";
import { DesktopEmailRow } from "./desktop-email-row";
import { InboxFilterBar } from "./inbox-filter-bar";
import { MobileEmailRow } from "./mobile-email-row";

const mailboxRoute = getRouteApi("/_dashboard/$mailboxId");

const DESKTOP_ROW_HEIGHT = 40;
const MOBILE_ROW_HEIGHT = 56;

export function EmailList({
  emailData,
  onOpen,
  onAction,
  pageTitle: pageTitleOverride,
  headerSlot,
  extraActions,
}: {
  emailData: ReturnType<typeof useEmailData>;
  onOpen: (email: EmailListItem) => void;
  onAction: (
    action: EmailInboxAction,
    ids?: string[],
    thread?: ThreadIdentifier,
  ) => void;
  pageTitle?: string;
  headerSlot?: React.ReactNode;
  extraActions?: React.ReactNode;
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
  const filterBarVisible = showFilters || hasActiveFilters;
  const { openCompose } = useInboxCompose();
  const isMobile = useIsMobile();
  const { mailboxId: routeMailboxId } = mailboxRoute.useParams();
  const navigate = useNavigate();
  const rowHeight = isMobile ? MOBILE_ROW_HEIGHT : DESKTOP_ROW_HEIGHT;
  const pageTitle =
    pageTitleOverride ?? (VIEW_LABELS as Record<string, string>)[view] ?? view;

  const { data: allLabels } = useQuery({
    queryKey: labelQueryKeys.list(mailboxId),
    queryFn: () => fetchLabels(mailboxId),
    staleTime: 60_000,
  });

  const gatekeeperPendingQuery = useGatekeeperPending(
    mailboxId,
    view === "inbox",
  );
  const pendingSendersCount = gatekeeperPendingQuery.data?.pendingCount ?? 0;

  const goToSearch = () =>
    navigate({
      to: "/$mailboxId/inbox/search",
      params: { mailboxId: routeMailboxId },
    });

  const { focusedIndex } = useInboxHotkeys({
    groups: threadGroups,
    view,
    onOpen,
    onAction,
    onCompose: openCompose,
    onSearch: goToSearch,
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  const isScrolled = useIsScrolled(scrollRef);

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
  const RowComponent = isMobile ? MobileEmailRow : DesktopEmailRow;

  const headerTitle = (
    <div className="flex items-center gap-2">
      <SidebarTrigger className="md:hidden -ml-1 size-8" />
      <span>{pageTitle}</span>
    </div>
  );

  const filterToggleButton =
    hasEmails || hasActiveFilters ? (
      <IconButton
        label={filterBarVisible ? "Hide filters" : "Show filters"}
        variant="ghost"
        size="icon-sm"
        onClick={() => setShowFilters((v) => !v)}
        className={cn("", showFilters && "bg-muted")}
      >
        <FunnelSimpleIcon className="size-3.5" />
      </IconButton>
    ) : null;

  const hasGatekeeperButton = view === "inbox" && pendingSendersCount > 0;

  const headerActions =
    headerSlot || extraActions || filterToggleButton || hasGatekeeperButton ? (
      <>
        {hasGatekeeperButton ? (
          <Button asChild variant="outline" size="sm">
            <Link
              to="/$mailboxId/screener"
              params={{ mailboxId: routeMailboxId }}
              preload="intent"
            >
              New senders: {pendingSendersCount} pending
            </Link>
          </Button>
        ) : null}
        {headerSlot}
        {extraActions}
        {filterToggleButton}
      </>
    ) : undefined;

  return (
    <div className="flex w-full min-h-0 min-w-0 flex-1 flex-col">
      <PageHeader
        title={headerTitle}
        actions={headerActions}
        isScrolled={isScrolled}
      />

      {(hasEmails || hasActiveFilters) && filterBarVisible && (
        <InboxFilterBar filters={filters} onChange={setFilters} view={view} />
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
              <EmptyTitle>No emails in {pageTitle.toLowerCase()}</EmptyTitle>
              <EmptyDescription>
                Messages that belong to this view will show up here.
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
