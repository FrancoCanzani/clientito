import { PageHeader } from "@/components/page-header";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useInboxCompose } from "@/features/email/inbox/components/compose/inbox-compose-provider";
import { useEmailData } from "@/features/email/inbox/hooks/use-email-data";
import type { EmailInboxAction } from "@/features/email/inbox/hooks/use-email-inbox-actions";
import { useInboxHotkeys } from "@/features/email/inbox/hooks/use-inbox-hotkeys";
import type { EmailListItem } from "@/features/email/inbox/types";
import { VIEW_LABELS } from "@/features/email/inbox/utils/inbox-filters";
import { CircleNotchIcon } from "@phosphor-icons/react";
import { getRouteApi, useNavigate } from "@tanstack/react-router";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useRef } from "react";
import { EmailRow } from "./email-row";

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
    hasEmails,
    threadGroups,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isSyncing,
    isInitialSync,
    loadMoreRef,
    canPullFromGmail,
    isPullingFromGmail,
  } = emailData;
  const { openCompose } = useInboxCompose();
  const { mailboxId } = mailboxRoute.useParams();
  const navigate = useNavigate();
  const pageTitle =
    pageTitleOverride ?? (VIEW_LABELS as Record<string, string>)[view] ?? view;

  const goToSearch = () =>
    navigate({ to: "/$mailboxId/inbox/search", params: { mailboxId } });

  const { focusedIndex } = useInboxHotkeys({
    groups: threadGroups,
    view,
    onOpen,
    onAction,
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

  const showLoadMoreSentinel =
    hasNextPage || isFetchingNextPage || canPullFromGmail || isPullingFromGmail;
  const loadMoreLabel = isFetchingNextPage
    ? "Loading more..."
    : isPullingFromGmail
      ? "Loading more from Gmail..."
      : "Scroll for more";

  return (
    <div className="flex w-full min-w-0 flex-1 flex-col">
      <PageHeader
        title={
          <div className="flex items-center gap-2">
            <SidebarTrigger className="md:hidden" />
            <span>{pageTitle}</span>
          </div>
        }
      />

      {hasEmails ? (
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
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
                    onAction={onAction}
                    isFocused={virtualItem.index === focusedIndex}
                  />
                </div>
              );
            })}
          </div>

          {showLoadMoreSentinel && (
            <div
              ref={loadMoreRef}
              className="pt-2 text-center text-xs text-muted-foreground"
            >
              {loadMoreLabel}
            </div>
          )}
        </div>
      ) : isInitialSync ? (
        <div className="flex min-h-56 flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <CircleNotchIcon className="size-5 animate-spin text-muted-foreground" />
          <div className="space-y-1">
            <p className="text-sm font-medium">Setting up your inbox</p>
            <p className="text-xs text-muted-foreground">
              This runs once. You can keep using the app — messages will appear
              as they arrive.
            </p>
          </div>
        </div>
      ) : isSyncing || isLoading ? (
        <div className="flex min-h-56 flex-1 flex-col items-center justify-center gap-3">
          <CircleNotchIcon className="size-5 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Checking for new mail…</p>
        </div>
      ) : (
        <Empty className="min-h-56 flex-1 justify-center">
          <EmptyHeader>
            <EmptyTitle>No emails in {pageTitle.toLowerCase()}</EmptyTitle>
            <EmptyDescription>
              Messages that belong to this view will show up here.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </div>
  );
}
