import { PageHeader } from "@/components/page-header";
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
import type { EmailListItem } from "@/features/email/inbox/types";
import { VIEW_LABELS } from "@/features/email/inbox/utils/inbox-filters";
import { MagnifyingGlassIcon, NotePencilIcon } from "@phosphor-icons/react";
import { getRouteApi, useNavigate } from "@tanstack/react-router";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useRef } from "react";
import { EmailRow } from "./email-row";

const mailboxRoute = getRouteApi("/_dashboard/$mailboxId");

const ROW_HEIGHT = 40;

export function EmailList({
  emailData,
  onOpen,
  onAction,
  selectedEmailId,
  pageTitle: pageTitleOverride,
  onFocusChange,
}: {
  emailData: ReturnType<typeof useEmailData>;
  onOpen: (email: EmailListItem) => void;
  onAction: (action: EmailInboxAction, ids?: string[]) => void;
  selectedEmailId?: string | null;
  pageTitle?: string;
  onFocusChange?: (emailId: string | null) => void;
}) {
  const {
    view,
    hasEmails,
    threadGroups,
    hasNextPage,
    isFetchingNextPage,
    isSyncing,
    loadMoreRef,
  } = emailData;
  const { openCompose } = useInboxCompose();
  const { mailboxId } = mailboxRoute.useParams();
  const navigate = useNavigate();
  const pageTitle = pageTitleOverride ?? (VIEW_LABELS as Record<string, string>)[view] ?? view;

  const goToSearch = () =>
    navigate({ to: "/$mailboxId/inbox/search", params: { mailboxId } });

  const { focusedIndex } = useInboxHotkeys({
    groups: threadGroups,
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
      const group = threadGroups[focusedIndex];
      onFocusChange?.(group?.representative.id ?? null);
    }
  }, [focusedIndex, threadGroups.length, virtualizer]);

  const virtualItems = virtualizer.getVirtualItems();

  return (
    <div className="flex w-full min-w-0 flex-1 flex-col">
      <PageHeader
        title={
          <div className="flex items-center gap-2">
            <SidebarTrigger className="md:hidden" />
            <span>{pageTitle}</span>
            {isSyncing && (
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-foreground/40" />
                <span className="relative inline-flex size-2 rounded-full bg-foreground/60" />
              </span>
            )}
          </div>
        }
        actions={
          <>
            <IconButton
              label="Search"
              shortcut="/"
              onClick={() =>
                navigate({
                  to: "/$mailboxId/inbox/search",
                  params: { mailboxId },
                })
              }
            >
              <MagnifyingGlassIcon className="size-3.5" />
            </IconButton>
            <IconButton
              label="New Email"
              shortcut="C"
              onClick={() => openCompose()}
            >
              <NotePencilIcon className="size-3.5" />
            </IconButton>
          </>
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
                    isSelected={group.representative.id === selectedEmailId}
                  />
                </div>
              );
            })}
          </div>

          {(hasNextPage || isFetchingNextPage) && (
            <div
              ref={loadMoreRef}
              className="pt-2 text-center text-xs text-muted-foreground"
            >
              {isFetchingNextPage ? "Loading more..." : "Scroll for more"}
            </div>
          )}
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
