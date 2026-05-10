import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { EmailDetailView } from "@/features/email/inbox/pages/email-detail-view";
import {
  useMailActions,
  type MailAction,
} from "@/features/email/mail/hooks/use-mail-actions";
import { useMailViewData } from "@/features/email/mail/hooks/use-mail-view-data";
import { EmailList } from "@/features/email/mail/list/email-list";
import { MailFilterBar } from "@/features/email/mail/list/mail-filter-bar";
import { ViewSyncStatusControl } from "@/features/email/mail/list/view-sync-status";
import type { ThreadIdentifier } from "@/features/email/mail/mutations";
import type { EmailListItem } from "@/features/email/mail/types";
import type { ThreadGroup } from "@/features/email/mail/utils/group-emails-by-thread";
import {
  MailboxPage,
  MailboxPageHeader,
} from "@/features/email/shell/mailbox-page";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { FunnelSimpleIcon } from "@phosphor-icons/react";
import { useCallback, type ReactNode } from "react";

export type MailViewData = ReturnType<typeof useMailViewData>;
export type MailSnoozeTarget = Parameters<
  ReturnType<typeof useMailActions>["snooze"]
>[0];

export function MailListReaderPage({
  showReader,
  listPane,
  readerPane,
}: {
  showReader: boolean;
  listPane: ReactNode;
  readerPane: ReactNode;
}) {
  if (!showReader) {
    return <MailboxPage className="max-w-none">{listPane}</MailboxPage>;
  }

  return (
    <MailboxPage className="max-w-none">
      <ResizablePanelGroup
        orientation="horizontal"
        className="min-h-0 flex-1 overflow-hidden"
      >
        <ResizablePanel
          defaultSize="50%"
          minSize="320px"
          maxSize="65%"
          className="min-w-0"
        >
          {listPane}
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel minSize="360px" defaultSize="50%" className="min-w-0">
          {readerPane}
        </ResizablePanel>
      </ResizablePanelGroup>
    </MailboxPage>
  );
}

export function getThreadGroupSnoozeTarget(
  group: ThreadGroup,
  fallbackMailboxId: number,
): MailSnoozeTarget {
  const mailboxId = group.representative.mailboxId ?? fallbackMailboxId;

  if (group.threadId && group.representative.mailboxId) {
    return {
      kind: "thread",
      thread: {
        threadId: group.threadId,
        mailboxId: group.representative.mailboxId,
        labelIds: group.representative.labelIds,
      },
    };
  }

  return {
    kind: "email",
    identifier: {
      id: group.representative.id,
      providerMessageId: group.representative.providerMessageId,
      mailboxId,
      labelIds: group.representative.labelIds,
    },
  };
}

export function useThreadGroupSnooze(
  mailboxId: number,
  snooze: ReturnType<typeof useMailActions>["snooze"],
) {
  return useCallback(
    (group: ThreadGroup, timestamp: number | null) => {
      void snooze(getThreadGroupSnoozeTarget(group, mailboxId), timestamp);
    },
    [mailboxId, snooze],
  );
}

export function MailListPane({
  title,
  emailData,
  showFilters,
  onShowFiltersChange,
  onOpen,
  onAction,
  selectedEmailId,
  enableKeyboardNavigation = true,
  compact = false,
  headerExtraActions,
  onSnooze,
  emptyTitle,
  emptyDescription,
}: {
  title: string;
  emailData: MailViewData;
  showFilters: boolean;
  onShowFiltersChange: (visible: boolean) => void;
  onOpen: ReturnType<typeof useMailActions>["openEmail"];
  onAction: (
    action: MailAction,
    ids?: string[],
    thread?: ThreadIdentifier,
  ) => void;
  onSnooze?: (group: ThreadGroup, timestamp: number | null) => void;
  selectedEmailId?: string | null;
  enableKeyboardNavigation?: boolean;
  compact?: boolean;
  headerExtraActions?: ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  const isMobile = useIsMobile();
  const showFilterControls = emailData.hasEmails || emailData.hasActiveFilters;
  const filterBarVisible = showFilters || emailData.hasActiveFilters;

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col">
      <MailboxPageHeader
        title={title}
        actions={
          <>
            {showFilterControls && filterBarVisible && !compact && (
              <MailFilterBar
                filters={emailData.filters}
                onChange={emailData.setFilters}
                view={emailData.view}
                className="hidden md:flex"
              />
            )}
            {headerExtraActions}
            {!isMobile && (
              <ViewSyncStatusControl
                isBusy={emailData.isLoading || emailData.isRefreshing}
                needsReconnect={emailData.needsReconnect}
                isRateLimited={emailData.isRateLimited}
                onRefresh={() => emailData.refreshView()}
                disabled={emailData.isRefreshingView}
              />
            )}
            {showFilterControls && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => onShowFiltersChange(!filterBarVisible)}
                aria-pressed={filterBarVisible}
                aria-label="Toggle filters"
                className={cn(
                  "text-muted-foreground",
                  filterBarVisible && "bg-muted",
                )}
              >
                <FunnelSimpleIcon className="size-3.5" />
              </Button>
            )}
          </>
        }
      />
      {showFilterControls && filterBarVisible && (
        <MailFilterBar
          filters={emailData.filters}
          onChange={emailData.setFilters}
          view={emailData.view}
          className={cn("flex px-3 pb-1.5", !compact && "md:hidden")}
        />
      )}
      <EmailList
        emailData={emailData}
        onOpen={onOpen}
        onAction={onAction}
        onSnooze={onSnooze}
        filterBarOpen={showFilters}
        onFilterBarOpenChange={onShowFiltersChange}
        enableKeyboardNavigation={enableKeyboardNavigation}
        selectedEmailId={selectedEmailId}
        emptyTitle={emptyTitle}
        emptyDescription={emptyDescription}
        hideFilterControls
      />
    </div>
  );
}

export function MailReaderPane({
  mailboxId,
  view,
  inboxMode,
  emailId,
  emptyDescription,
  onClose,
  onNavigateToEmail,
  listGroups,
  hasNextPage = false,
  isFetchingNextPage = false,
  fetchNextPage,
}: {
  mailboxId: number;
  view: string;
  inboxMode?: "important" | "all";
  emailId: string | null;
  emptyDescription: string;
  onClose: () => void;
  onNavigateToEmail: (nextEmailId: string) => void;
  listGroups?: ThreadGroup[];
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  fetchNextPage?: () => Promise<unknown>;
}) {
  if (!emailId) {
    return (
      <div className="flex h-full min-h-0 min-w-0 flex-col bg-background">
        <Empty>
          <EmptyHeader>
            <EmptyTitle>Select an email</EmptyTitle>
            <EmptyDescription>{emptyDescription}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col bg-background">
      <EmailDetailView
        mailboxId={mailboxId}
        emailId={emailId}
        view={view}
        inboxMode={inboxMode}
        onClose={onClose}
        onNavigateToEmail={onNavigateToEmail}
        listGroups={listGroups}
        hasNextPage={hasNextPage}
        isFetchingNextPage={isFetchingNextPage}
        fetchNextPage={fetchNextPage}
        embedded
      />
    </div>
  );
}

export type { EmailListItem };
