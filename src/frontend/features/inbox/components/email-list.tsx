import { AccountSwitcher } from "@/components/account-switcher";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { useEmailData } from "@/features/inbox/hooks/use-email-data";
import { useEmailInboxActions } from "@/features/inbox/hooks/use-email-inbox-actions";
import { useSelectionStore } from "@/features/inbox/stores/selection-store";
import { VIEW_LABELS } from "@/features/inbox/utils/inbox-filters";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { useMemo } from "react";
import { EmailBulkToolbar } from "./email-bulk-toolbar";
import { EmailContextMenu } from "./email-context-menu";
import { EmailRow } from "./email-row";

export function EmailList() {
  const isMobile = useIsMobile();
  const {
    view,
    mailboxId,
    selectedEmailId,
    displayRows,
    sections,
    selectedEmail,
    isPending,
    isError,
    hasNextPage,
    isFetchingNextPage,
    loadMoreRef,
  } = useEmailData();

  const selection = useSelectionStore(displayRows);
  const selectedIds = useMemo(
    () => Array.from(selection.selectedIds),
    [selection.selectedIds],
  );
  const selectedEmails = useMemo(
    () => displayRows.filter((e) => selection.selectedIds.has(e.id)),
    [displayRows, selection.selectedIds],
  );
  const allVisibleSelected =
    displayRows.length > 0 && selection.count === displayRows.length;

  const { openEmail, executeEmailAction } = useEmailInboxActions({
    view,
    mailboxId,
    selectedEmailId,
    selectedIds,
    clearSelection: selection.clearSelection,
  });

  const isSplitView = !isMobile && selectedEmail !== null;
  const pageTitle = VIEW_LABELS[view];

  return (
    <div
      className={cn(
        "flex min-w-0 flex-col",
        isSplitView
          ? "h-full w-full overflow-hidden px-4 py-4"
          : "mx-auto w-full max-w-3xl",
      )}
    >
      <div className={cn("min-h-0 flex-1", isSplitView && "overflow-y-auto")}>
        <header className="sticky top-0 z-20 flex items-center gap-2 bg-background pb-2">
          <h2 className="text-lg font-medium">{pageTitle}</h2>
          <AccountSwitcher />
        </header>

        {selection.selectionMode && selection.hasSelection && (
          <EmailBulkToolbar
            count={selection.count}
            allSelected={allVisibleSelected}
            disabled={false}
            onSelectAll={selection.selectAll}
            onArchive={() => executeEmailAction("archive", selectedIds)}
            onTrash={() => executeEmailAction("trash", selectedIds)}
            onMarkRead={() => executeEmailAction("mark-read", selectedIds)}
            onMarkUnread={() => executeEmailAction("mark-unread", selectedIds)}
            onStarToggle={() => {
              const allStarred = selectedEmails.every((e) =>
                e.labelIds.includes("STARRED"),
              );
              executeEmailAction(allStarred ? "unstar" : "star", selectedIds);
            }}
            onDeselect={selection.clearSelection}
          />
        )}

        {isPending ? (
          <div className="space-y-2">
            {Array.from({ length: 10 }).map((_, index) => (
              <Skeleton
                key={index}
                className="h-11 w-full rounded-md animate-in fade-in-0"
                style={{
                  animationDelay: `${index * 50}ms`,
                  animationFillMode: "backwards",
                }}
              />
            ))}
          </div>
        ) : isError ? (
          <p className="rounded-md border border-destructive/20 bg-destructive/10 p-4 text-center text-sm text-destructive">
            Failed to load emails.
          </p>
        ) : displayRows.length > 0 ? (
          <div className="space-y-5">
            {sections.map((section) => (
              <section key={section.label} className="space-y-1.5">
                <div className="sticky top-9 z-10 bg-background py-1 text-xs text-muted-foreground">
                  {section.label}
                </div>
                <div className="space-y-1 [&:has(>[data-email-row]:hover)>[data-email-row]:not(:hover)]:opacity-85">
                  {section.items.map((group) => {
                    const email = group.representative;
                    const selected = selection.isSelected(email.id);
                    const isOpen = email.id === selectedEmailId;
                    const targetEmails =
                      selected && selection.hasSelection
                        ? selectedEmails
                        : [email];
                    const targetIds = targetEmails.map((item) => item.id);

                    return (
                      <EmailContextMenu
                        key={email.id}
                        email={email}
                        selected={selected}
                        targetEmails={targetEmails}
                        onArchive={() => executeEmailAction("archive", targetIds)}
                        onTrash={() => executeEmailAction("trash", targetIds)}
                        onSpam={() => executeEmailAction("spam", targetIds)}
                        onSetRead={(read) =>
                          executeEmailAction(read ? "mark-read" : "mark-unread", targetIds)
                        }
                        onSetStarred={(starred) =>
                          executeEmailAction(starred ? "star" : "unstar", targetIds)
                        }
                        onToggleSelect={() => selection.toggleSelectionFromMenu(email.id)}
                        onSelectAll={selection.selectAll}
                      >
                        <EmailRow
                          email={email}
                          threadCount={group.threadCount}
                          view={view}
                          isSelected={selected}
                          isOpen={isOpen}
                          selectionMode={selection.selectionMode}
                          onOpen={() => openEmail(email)}
                          onToggleSelection={(shiftKey) =>
                            selection.toggleSelection(email.id, shiftKey)
                          }
                        />
                      </EmailContextMenu>
                    );
                  })}
                </div>
              </section>
            ))}

            {hasNextPage && (
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
    </div>
  );
}
