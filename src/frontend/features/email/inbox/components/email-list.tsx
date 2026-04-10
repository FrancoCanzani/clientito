import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useInboxCompose } from "@/features/email/inbox/components/inbox-compose-provider";
import { useEmailData } from "@/features/email/inbox/hooks/use-email-data";
import type { EmailInboxAction } from "@/features/email/inbox/hooks/use-email-inbox-actions";
import type { EmailListItem } from "@/features/email/inbox/types";
import { VIEW_LABELS } from "@/features/email/inbox/utils/inbox-filters";
import type { ThreadGroup } from "@/features/email/inbox/utils/group-emails-by-thread";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useCallback, useMemo, useRef } from "react";
import { EmailRow } from "./email-row";

type FlatItem =
  | { type: "header"; label: string }
  | { type: "row"; group: ThreadGroup };

const HEADER_HEIGHT = 40;
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
    sections,
    hasNextPage,
    isFetchingNextPage,
    loadMoreRef,
  } = emailData;
  const { openCompose } = useInboxCompose();
  const pageTitle = VIEW_LABELS[view];

  const flatItems = useMemo<FlatItem[]>(() => {
    const items: FlatItem[] = [];
    for (const section of sections) {
      items.push({ type: "header", label: section.label });
      for (const group of section.items) {
        items.push({ type: "row", group });
      }
    }
    return items;
  }, [sections]);

  const parentRef = useRef<HTMLDivElement>(null);

  const estimateSize = useCallback(
    (index: number) =>
      flatItems[index]?.type === "header" ? HEADER_HEIGHT : ROW_HEIGHT,
    [flatItems],
  );

  const virtualizer = useVirtualizer({
    count: flatItems.length,
    getScrollElement: () => parentRef.current,
    estimateSize,
    overscan: 10,
  });

  return (
    <div className="flex min-h-0 w-full max-w-3xl min-w-0 flex-1 flex-col">
      <PageHeader
        title={
          <div className="flex items-center gap-2">
            <SidebarTrigger className="md:hidden" />
            <span>{pageTitle}</span>
          </div>
        }
        actions={
          view === "inbox" && (
            <Button type="button" variant="ghost" onClick={() => openCompose()}>
              New Email
            </Button>
          )
        }
      />

      {hasEmails ? (
        <div ref={parentRef} className="min-h-0 flex-1 overflow-auto">
          <div
            className="relative w-full"
            style={{ height: virtualizer.getTotalSize() }}
          >
            {virtualizer.getVirtualItems().map((virtualItem) => {
              const item = flatItems[virtualItem.index]!;

              if (item.type === "header") {
                return (
                  <div
                    key={`header-${item.label}`}
                    className="absolute left-0 w-full bg-background pt-4 pb-2 text-xs text-muted-foreground"
                    style={{
                      height: virtualItem.size,
                      transform: `translateY(${virtualItem.start}px)`,
                    }}
                  >
                    {item.label}
                  </div>
                );
              }

              return (
                <div
                  key={item.group.representative.id}
                  className="absolute left-0 w-full"
                  style={{
                    height: virtualItem.size,
                    transform: `translateY(${virtualItem.start}px)`,
                  }}
                >
                  <EmailRow
                    group={item.group}
                    view={view}
                    onOpen={onOpen}
                    onAction={onAction}
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
