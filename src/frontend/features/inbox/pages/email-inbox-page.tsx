import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Skeleton } from "@/components/ui/skeleton";
import { type ComposeInitial } from "@/features/inbox/components/compose-email-dialog";
import { ComposePanel } from "@/features/inbox/components/compose-panel";
import { DraftListView } from "@/features/inbox/components/draft-list-view";
import { EmailBulkToolbar } from "@/features/inbox/components/email-bulk-toolbar";
import { EmailContextMenu } from "@/features/inbox/components/email-context-menu";
import { EmailDetailContent } from "@/features/inbox/components/email-detail-content";
import { EmailDetailSheet } from "@/features/inbox/components/email-detail-sheet";
import {
  useRegisterEmailCommandHandler,
  type EmailCommand,
} from "@/features/inbox/hooks/use-email-command-state";
import { useEmailData } from "@/features/inbox/hooks/use-email-data";
import { useEmailInboxActions } from "@/features/inbox/hooks/use-email-inbox-actions";
import { useEmailInboxKeyboard } from "@/features/inbox/hooks/use-email-inbox-keyboard";
import { useEmailSelection } from "@/features/inbox/hooks/use-email-selection";
import { formatInboxRowDate } from "@/features/inbox/utils/format-inbox-row-date";
import { VIEW_LABELS } from "@/features/inbox/utils/inbox-filters";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSetPageContext } from "@/hooks/use-page-context";
import { cn } from "@/lib/utils";
import {
  CaretDownIcon,
  CaretUpIcon,
  PaperclipIcon,
  XIcon,
} from "@phosphor-icons/react";
import { getRouteApi } from "@tanstack/react-router";
import { useCallback, useMemo, useState } from "react";

const emailsRoute = getRouteApi("/_dashboard/inbox/");

export default function EmailInboxPage() {
  const navigate = emailsRoute.useNavigate();
  const search = emailsRoute.useSearch();
  const { initialEmails } = emailsRoute.useLoaderData();
  const isMobile = useIsMobile();

  const view = search.view ?? "inbox";
  const selectedEmailId = search.id ?? search.emailId ?? null;
  const isComposing = search.compose === true;

  const [composeInitial, setComposeInitial] = useState<
    ComposeInitial | undefined
  >();
  const [composeDraftId, setComposeDraftId] = useState<number | undefined>();
  const [forwardOpen, setForwardOpen] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [lastClickedId, setLastClickedId] = useState<string | null>(null);

  const {
    displayRows,
    sections,
    selectedEmail,
    orderedIds,
    emailById,
    emailsPending,
    emailsError,
    hasNextPage,
    isFetchingNextPage,
    loadMoreRef,
  } = useEmailData({
    view,
    initialEmails,
    selectedEmailId,
  });

  const selection = useEmailSelection(displayRows);
  const selectedIds = useMemo(
    () => Array.from(selection.selectedIds),
    [selection.selectedIds],
  );
  const selectedEmails = useMemo(
    () => displayRows.filter((email) => selection.selectedIds.has(email.id)),
    [displayRows, selection.selectedIds],
  );
  const isSplitView = !isMobile && selectedEmail !== null;
  const allVisibleSelected =
    displayRows.length > 0 && selection.count === displayRows.length;

  useSetPageContext(
    useMemo(
      () => ({
        route: "inbox",
        entity: selectedEmail
          ? {
              type: "email" as const,
              id: selectedEmail.id,
              subject: selectedEmail.subject,
              fromName: selectedEmail.fromName,
              fromAddr: selectedEmail.fromAddr,
              threadId: selectedEmail.threadId,
            }
          : undefined,
      }),
      [selectedEmail],
    ),
  );
  const pageTitle = VIEW_LABELS[view];

  const clearSelection = useCallback(() => {
    selection.deselectAll();
    setSelectionMode(false);
  }, [selection]);

  const selectAllVisible = useCallback(() => {
    setSelectionMode(true);
    selection.selectAll();
  }, [selection]);

  const toggleSelection = useCallback(
    (emailId: string, shiftKey: boolean) => {
      setSelectionMode(true);
      if (shiftKey && lastClickedId) {
        selection.selectRange(lastClickedId, emailId);
      } else {
        selection.toggle(emailId);
      }
      setLastClickedId(emailId);
    },
    [lastClickedId, selection],
  );

  const toggleSelectionFromMenu = useCallback(
    (emailId: string) => {
      setSelectionMode(true);
      selection.toggle(emailId);
      setLastClickedId(emailId);
    },
    [selection],
  );

  const { openEmail, closeEmail, executeEmailAction, mutationPending } =
    useEmailInboxActions({
      view,
      selectedEmailId,
      selectedIds,
      selection,
      onSelectionCleared: clearSelection,
    });

  const handleEmailCommand = useCallback(
    (command: EmailCommand) => {
      switch (command.type) {
        case "selection-mode":
          setSelectionMode(command.enabled);
          if (!command.enabled) {
            selection.deselectAll();
          }
          break;
        case "select-all-visible":
          setSelectionMode(true);
          selection.selectAll();
          break;
        case "clear-selection":
          clearSelection();
          break;
      }
    },
    [clearSelection, selection],
  );

  useRegisterEmailCommandHandler(handleEmailCommand);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        closeEmail();
      }
    },
    [closeEmail],
  );

  const handleForward = useCallback(
    (initial: ComposeInitial) => {
      handleOpenChange(false);
      setComposeInitial(initial);
      setForwardOpen(true);
    },
    [handleOpenChange],
  );

  const { goToEmail, hasPrev, hasNext } = useEmailInboxKeyboard({
    orderedIds,
    selectedEmailId,
    emailById,
    openEmail,
    closeEmail,
    executeEmailAction,
  });

  if (view === "drafts") {
    return (
      <>
        <DraftListView
          onOpenDraft={(draft) => {
            setComposeInitial({
              to: draft.to ?? undefined,
              cc: draft.cc ?? undefined,
              subject: draft.subject ?? undefined,
              body: draft.body ?? undefined,
            });
            setComposeDraftId(draft.id);
            navigate({
              search: (prev) => ({ ...prev, compose: true }),
              replace: true,
            });
          }}
        />
        <ComposePanel
          open={isComposing}
          initial={composeInitial}
          draftId={composeDraftId}
          onOpenChange={(open) => {
            if (!open) {
              setComposeInitial(undefined);
              setComposeDraftId(undefined);
              navigate({
                search: (prev) => ({
                  ...prev,
                  compose: undefined,
                }),
                replace: true,
              });
            }
          }}
        />
      </>
    );
  }

  const emailListContent = (
    <div
      className={cn(
        "flex min-w-0 flex-col",
        isSplitView
          ? "h-full w-full overflow-hidden px-4 py-4"
          : "mx-auto w-full max-w-4xl",
      )}
    >
      <div
        className={cn("min-h-0 flex-1", isSplitView && "overflow-y-auto")}
      >
        <header className="sticky top-0 z-20 bg-background pb-2">
          <h2 className="text-lg font-medium">{pageTitle}</h2>
        </header>

        {selectionMode && selection.hasSelection && (
          <EmailBulkToolbar
            count={selection.count}
            allSelected={allVisibleSelected}
            disabled={mutationPending}
            onSelectAll={selectAllVisible}
            onArchive={() => executeEmailAction("archive", selectedIds)}
            onTrash={() => executeEmailAction("trash", selectedIds)}
            onMarkRead={() => executeEmailAction("mark-read", selectedIds)}
            onMarkUnread={() => executeEmailAction("mark-unread", selectedIds)}
            onStarToggle={() => {
              const allStarred = selectedEmails.every((email) =>
                email.labelIds.includes("STARRED"),
              );
              executeEmailAction(allStarred ? "unstar" : "star", selectedIds);
            }}
            onDeselect={clearSelection}
          />
        )}
        {emailsPending ? (
          <div className="space-y-2">
            {Array.from({ length: 10 }).map((_, index) => (
              <Skeleton
                key={index}
                className="h-11 w-full rounded-md animate-in fade-in-0"
                style={{ animationDelay: `${index * 50}ms`, animationFillMode: "backwards" }}
              />
            ))}
          </div>
        ) : emailsError ? (
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
                    const isSelected = selection.isSelected(email.id);
                    const isOpen = email.id === selectedEmailId;
                    const targetEmails =
                      isSelected && selection.hasSelection
                        ? selectedEmails
                        : [email];
                    const targetIds = targetEmails.map((item) => item.id);
                    const participantLabel =
                      view === "sent"
                        ? email.toAddr
                          ? `To: ${email.toAddr}`
                          : "To: (unknown recipient)"
                        : email.fromName || email.fromAddr;

                    return (
                      <EmailContextMenu
                        key={email.id}
                        email={email}
                        selected={isSelected}
                        targetEmails={targetEmails}
                        onArchive={() =>
                          executeEmailAction("archive", targetIds)
                        }
                        onTrash={() => executeEmailAction("trash", targetIds)}
                        onSpam={() => executeEmailAction("spam", targetIds)}
                        onSetRead={(isRead) =>
                          executeEmailAction(
                            isRead ? "mark-read" : "mark-unread",
                            targetIds,
                          )
                        }
                        onSetStarred={(starred) =>
                          executeEmailAction(
                            starred ? "star" : "unstar",
                            targetIds,
                          )
                        }
                        onToggleSelect={() => toggleSelectionFromMenu(email.id)}
                        onSelectAll={selectAllVisible}
                      >
                        <div
                          data-email-row
                          role="button"
                          tabIndex={0}
                          className={cn(
                            "flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-[opacity,background-color] duration-200 ease-out hover:bg-muted/40 cursor-default",
                            isOpen && "bg-muted/50",
                          )}
                          onClick={() => openEmail(email)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              openEmail(email);
                            }
                          }}
                        >
                          {selectionMode ? (
                            <Checkbox
                              checked={isSelected}
                              className="shrink-0"
                              aria-label={`Select email from ${email.fromName || email.fromAddr}`}
                              onClick={(event) => {
                                event.stopPropagation();
                                toggleSelection(email.id, event.shiftKey);
                              }}
                              onKeyDown={(event) => {
                                event.stopPropagation();
                              }}
                            />
                          ) : null}

                          <span
                            className={cn(
                              "size-1.5 shrink-0 rounded-full",
                              email.isRead ? "hidden" : "bg-blue-500",
                            )}
                            aria-hidden
                          />

                          <div className="min-w-0 flex-1 items-center gap-2 overflow-hidden text-sm sm:flex">
                            <span className="shrink-0 truncate font-medium text-foreground sm:max-w-52">
                              {participantLabel}
                            </span>
                            <span className="truncate text-muted-foreground">
                              {email.subject ?? "(no subject)"}
                            </span>
                          </div>

                          <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                            {email.hasAttachment && (
                              <PaperclipIcon className="size-3.5" aria-hidden />
                            )}
                            {group.threadCount > 1 && (
                              <span className="rounded-full border border-border/70 px-1.5 py-0.5 font-mono text-[10px] text-foreground">
                                {group.threadCount}
                              </span>
                            )}
                            <span className="font-mono">
                              {formatInboxRowDate(email.date)}
                            </span>
                          </div>
                        </div>
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
          <p className="rounded-md border border-border/60 p-4 text-center text-sm text-muted-foreground">
            No emails found.
          </p>
        )}
      </div>
    </div>
  );

  const desktopDetailPanel = selectedEmail ? (
    <div className="flex h-full min-w-0 flex-col overflow-hidden border-l border-border">
      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto p-4">
        <EmailDetailContent
          key={selectedEmail.id}
          email={selectedEmail}
          onClose={closeEmail}
          onForward={handleForward}
          headerActions={
            <>
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                disabled={!hasPrev}
                onClick={() => goToEmail("prev")}
                title="Previous"
              >
                <CaretUpIcon className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                disabled={!hasNext}
                onClick={() => goToEmail("next")}
                title="Next"
              >
                <CaretDownIcon className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                onClick={closeEmail}
                title="Close"
                aria-label="Close"
              >
                <XIcon className="size-4" />
              </Button>
            </>
          }
        />
      </div>
    </div>
  ) : null;

  const composePanel = (
    <ComposePanel
      open={isComposing || forwardOpen}
      initial={forwardOpen ? composeInitial : undefined}
      onOpenChange={(open) => {
        if (!open) {
          setForwardOpen(false);
          setComposeInitial(undefined);
          if (isComposing) {
            navigate({
              search: (prev) => ({
                ...prev,
                compose: undefined,
              }),
              replace: true,
            });
          }
        }
      }}
    />
  );

  if (isMobile) {
    return (
      <>
        {emailListContent}
        <EmailDetailSheet
          email={selectedEmail}
          open={selectedEmail !== null}
          onOpenChange={handleOpenChange}
          onForward={handleForward}
        />
        {composePanel}
      </>
    );
  }

  if (!selectedEmail) {
    return (
      <>
        {emailListContent}
        {composePanel}
      </>
    );
  }

  return (
    <>
      <div className="mx-4! max-w-none! -mt-4 -mb-24 h-dvh min-w-0 overflow-hidden">
        <ResizablePanelGroup orientation="horizontal">
          <ResizablePanel
            defaultSize="50%"
            minSize="30%"
            maxSize="65%"
            className="min-w-0 overflow-hidden"
          >
            {emailListContent}
          </ResizablePanel>
          <ResizableHandle />
          <ResizablePanel
            defaultSize="50%"
            minSize="35%"
            className="min-w-0 overflow-hidden"
          >
            {desktopDetailPanel}
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
      {composePanel}
    </>
  );
}
