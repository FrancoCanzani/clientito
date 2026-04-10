import { PageHeader } from "@/components/page-header";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { IconButton } from "@/components/ui/icon-button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useInboxCompose } from "@/features/email/inbox/components/inbox-compose-provider";
import { useEmailData } from "@/features/email/inbox/hooks/use-email-data";
import type { EmailInboxAction } from "@/features/email/inbox/hooks/use-email-inbox-actions";
import { useInboxHotkeys } from "@/features/email/inbox/hooks/use-inbox-hotkeys";
import type { EmailListItem } from "@/features/email/inbox/types";
import { VIEW_LABELS } from "@/features/email/inbox/utils/inbox-filters";
import { NotePencilIcon } from "@phosphor-icons/react";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useRef } from "react";
import { EmailRow } from "./email-row";

const ROW_HEIGHT = 40;

export function EmailList({
  emailData,
  onOpen,
  onAction,
}: {
  emailData: ReturnType<typeof useEmailData>;
  onOpen: (email: EmailListItem) => void;
  onAction: (action: EmailInboxAction, ids?: string[]) => void;
}) {
  const {
    view,
    hasEmails,
    threadGroups,
    hasNextPage,
    isFetchingNextPage,
    loadMoreRef,
  } = emailData;
  const { openCompose } = useInboxCompose();
  const pageTitle = VIEW_LABELS[view];

  const { focusedIndex } = useInboxHotkeys({
    groups: threadGroups,
    onOpen,
    onAction,
    onCompose: openCompose,
  });

  const listRef = useRef<HTMLDivElement>(null);

  const virtualizer = useWindowVirtualizer({
    count: threadGroups.length,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
    scrollMargin: listRef.current?.offsetTop ?? 0,
  });

  // Scroll focused item into view
  useEffect(() => {
    if (focusedIndex < 0) return;
    if (focusedIndex < threadGroups.length) {
      virtualizer.scrollToIndex(focusedIndex, { align: "auto" });
    }
  }, [focusedIndex, threadGroups.length, virtualizer]);

  const virtualItems = virtualizer.getVirtualItems();

  return (
    <div className="flex w-full max-w-3xl min-w-0 flex-1 flex-col">
      <PageHeader
        title={
          <div className="flex items-center gap-2">
            <SidebarTrigger className="md:hidden" />
            <span>{pageTitle}</span>
          </div>
        }
        actions={
          view === "inbox" && (
            <IconButton
              label="New Email"
              shortcut="C"
              onClick={() => openCompose()}
            >
              <NotePencilIcon className="size-3.5" />
            </IconButton>
          )
        }
      />

      {hasEmails ? (
        <>
          <div ref={listRef}>
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
                      transform: `translateY(${virtualItem.start - virtualizer.options.scrollMargin}px)`,
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

            {(hasNextPage || isFetchingNextPage) && (
              <div
                ref={loadMoreRef}
                className="pt-2 text-center text-xs text-muted-foreground"
              >
                {isFetchingNextPage ? "Loading more..." : "Scroll for more"}
              </div>
            )}
          </div>
        </>
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
