import { AccountSwitcher } from "@/components/account-switcher";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { useEmail } from "@/features/inbox/context/email-context";
import { VIEW_LABELS } from "@/features/inbox/utils/inbox-filters";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { Link, getRouteApi } from "@tanstack/react-router";
import { useMemo } from "react";
import { EmailBulkToolbar } from "./email-bulk-toolbar";
import { EmailContextMenu } from "./email-context-menu";
import { EmailRow } from "./email-row";

const emailsRoute = getRouteApi("/_dashboard/inbox/$id/");

export function EmailList() {
  const isMobile = useIsMobile();
  const search = emailsRoute.useSearch();
  const {
    view,
    mailboxId,
    selectedEmailId,
    displayRows,
    sections,
    selectedEmail,
    hasNextPage,
    isFetchingNextPage,
    loadMoreRef,
    selection,
    openEmail,
    executeEmailAction,
  } = useEmail();

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

  const isSplitView = !isMobile && selectedEmail !== null;
  const pageTitle = VIEW_LABELS[view];

  return (
    <div
      className={cn(
        "flex min-w-0 flex-col",
        isSplitView
          ? "h-full w-full overflow-hidden p-4"
          : "mx-auto w-full max-w-3xl",
      )}
    >
      <div
        className={cn(
          "min-h-0 flex-1 space-y-6",
          isSplitView && "overflow-y-auto",
        )}
      >
        <header className="sticky top-0 z-20 flex items-center justify-between bg-background py-2">
          <h2 className="text-xl font-medium">{pageTitle}</h2>
          <div className="flex items-center justify-end gap-2">
            <AccountSwitcher />

            <Button asChild size="sm" variant={"secondary"}>
              <Link
                to="/inbox/$id"
                params={{ id: mailboxId != null ? String(mailboxId) : "all" }}
                search={{
                  view: search.view,
                  compose: true,
                  id: search.id,
                  emailId: search.emailId,
                  threadId: search.threadId,
                }}
              >
                New Email
              </Link>
            </Button>
          </div>
        </header>

        {selection.selectionMode && selection.hasSelection && (
          <EmailBulkToolbar
            count={selection.count}
            allSelected={allVisibleSelected}
            disabled={false}
            onToggleAll={(checked) => {
              if (checked) {
                selection.selectAll();
                return;
              }
              selection.clearSelection();
            }}
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

        {displayRows.length > 0 ? (
          <div className="space-y-5">
            {sections.map((section) => (
              <section key={section.label} className="space-y-1.5">
                <div className="sticky top-9 z-10 bg-background py-2 text-xs text-muted-foreground">
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
                        onArchive={() =>
                          executeEmailAction("archive", targetIds)
                        }
                        onTrash={() => executeEmailAction("trash", targetIds)}
                        onSpam={() => executeEmailAction("spam", targetIds)}
                        onSetRead={(read) =>
                          executeEmailAction(
                            read ? "mark-read" : "mark-unread",
                            targetIds,
                          )
                        }
                        onSetStarred={(starred) =>
                          executeEmailAction(
                            starred ? "star" : "unstar",
                            targetIds,
                          )
                        }
                        onToggleSelect={() =>
                          selection.toggleSelectionFromMenu(email.id)
                        }
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
