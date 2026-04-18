import { PageHeader } from "@/components/page-header";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { IconButton } from "@/components/ui/icon-button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useInboxCompose } from "@/features/email/inbox/components/compose/inbox-compose-provider";
import { useEmailData } from "@/features/email/inbox/hooks/use-email-data";
import type { EmailInboxAction } from "@/features/email/inbox/hooks/use-email-inbox-actions";
import { useInboxHotkeys } from "@/features/email/inbox/hooks/use-inbox-hotkeys";
import {
  useInboxSelection,
  type SelectFilter,
} from "@/features/email/inbox/hooks/use-inbox-selection";
import type { EmailListItem } from "@/features/email/inbox/types";
import { VIEW_LABELS } from "@/features/email/inbox/utils/inbox-filters";
import { fetchLabels } from "@/features/email/labels/queries";
import { queryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";
import {
  CaretDownIcon,
  CircleNotchIcon,
  FunnelSimpleIcon,
} from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { getRouteApi, useNavigate } from "@tanstack/react-router";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useRef, useState } from "react";
import { EmailRow } from "./email-row";
import { InboxFilterBar } from "./inbox-filter-bar";
import { SelectionActions } from "./selection-actions";

const mailboxRoute = getRouteApi("/_dashboard/$mailboxId");

const ROW_HEIGHT = 48;

export function EmailList({
  emailData,
  onOpen,
  onAction,
  pageTitle: pageTitleOverride,
}: {
  emailData: ReturnType<typeof useEmailData>;
  onOpen: (email: EmailListItem) => void;
  onAction: (action: EmailInboxAction, ids?: string[]) => void;
  pageTitle?: string;
}) {
  const {
    view,
    mailboxId,
    hasEmails,
    threadGroups,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isFirstSync,
    loadMoreRef,
    filters,
    setFilters,
    hasActiveFilters,
  } = emailData;
  const [showFilters, setShowFilters] = useState(false);
  const filterBarVisible = showFilters || hasActiveFilters;
  const { openCompose } = useInboxCompose();
  const { mailboxId: routeMailboxId } = mailboxRoute.useParams();
  const navigate = useNavigate();
  const pageTitle =
    pageTitleOverride ?? (VIEW_LABELS as Record<string, string>)[view] ?? view;

  const { data: allLabels } = useQuery({
    queryKey: queryKeys.labels(mailboxId),
    queryFn: () => fetchLabels(mailboxId),
    staleTime: 60_000,
  });

  const selection = useInboxSelection(threadGroups, view);

  const handleAction = (action: EmailInboxAction, ids?: string[]) => {
    onAction(action, ids);
    if (ids && ids.length > 1) selection.clear();
  };

  const goToSearch = () =>
    navigate({
      to: "/$mailboxId/inbox/search",
      params: { mailboxId: routeMailboxId },
    });

  const { focusedIndex } = useInboxHotkeys({
    groups: threadGroups,
    view,
    onOpen,
    onAction: handleAction,
    onCompose: openCompose,
    onSearch: goToSearch,
  });

  const scrollRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: threadGroups.length,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
    getScrollElement: () => scrollRef.current,
  });

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

  const selectOptions: { key: SelectFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "none", label: "None" },
    { key: "read", label: "Read" },
    { key: "unread", label: "Unread" },
  ];

  const headerControls = hasEmails && (
    <div className="flex w-10 shrink-0 items-center gap-1">
      <Checkbox
        aria-label={selection.hasSelection ? "Clear selection" : "Select all"}
        checked={selection.hasSelection}
        onClick={(event) => {
          event.preventDefault();
          selection.toggleAll();
        }}
      />
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Selection filter"
          className="flex size-5 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
        >
          <CaretDownIcon className="size-3" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {selectOptions.map((opt) => (
            <DropdownMenuItem
              key={opt.key}
              onSelect={() => selection.applyFilter(opt.key)}
            >
              {opt.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  const headerTitle = (
    <div className="flex items-center gap-3">
      <SidebarTrigger className="md:hidden" />
      {headerControls}
      {selection.hasSelection ? (
        <span className="text-muted-foreground text-sm">
          {selection.selectedIds.length} selected
        </span>
      ) : (
        <span>{pageTitle}</span>
      )}
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

  const headerActions = selection.hasSelection ? (
    <SelectionActions
      selectedIds={selection.selectedIds}
      groups={threadGroups}
      view={view}
      mailboxId={mailboxId}
      onAction={handleAction}
      onClear={selection.clear}
    />
  ) : (
    (filterToggleButton ?? undefined)
  );

  return (
    <div className="flex w-full min-w-0 flex-1 flex-col">
      <PageHeader title={headerTitle} actions={headerActions} />

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
                  <EmailRow
                    group={group}
                    view={view}
                    onOpen={onOpen}
                    onAction={handleAction}
                    isFocused={virtualItem.index === focusedIndex}
                    index={virtualItem.index}
                    isSelected={selection.isSelected(group.representative.id)}
                    onToggleSelect={selection.toggle}
                    anySelected={selection.hasSelection}
                    allLabels={allLabels}
                  />
                </div>
              );
            })}
          </div>
        ) : isLoading || isFirstSync ? (
          <div className="flex min-h-56 flex-col items-center justify-center gap-3">
            <CircleNotchIcon className="size-5 animate-spin text-muted-foreground" />
            {isFirstSync && !isLoading && (
              <p className="text-muted-foreground text-sm">
                Syncing your Gmail&hellip;
              </p>
            )}
          </div>
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
