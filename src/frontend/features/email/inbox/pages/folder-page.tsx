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
import { useQueryClient } from "@tanstack/react-query";
import { useArchivedData } from "@/features/email/inbox/hooks/use-archived-data";
import { useMailPanelSelection } from "@/features/email/inbox/hooks/use-mail-panel-selection";
import { useThreadGroupSnooze } from "@/features/email/inbox/hooks/use-thread-group-snooze";
import { EmailDetailView } from "@/features/email/inbox/pages/email-detail-view";
import { useMailActions } from "@/features/email/mail/hooks/use-mail-actions";
import { useMailViewData } from "@/features/email/mail/hooks/use-mail-view-data";
import { emailQueryKeys } from "@/features/email/mail/query-keys";
import { DeleteAllButton } from "@/features/email/mail/list/delete-all-button";
import { EmailList } from "@/features/email/mail/list/email-list";
import { MailFilterBar } from "@/features/email/mail/list/mail-filter-bar";
import { ViewSyncStatusControl } from "@/features/email/mail/list/view-sync-status";
import { VIEW_LABELS, type EmailFolderView } from "@/features/email/mail/views";
import {
  MailboxPage,
  MailboxPageHeader,
} from "@/features/email/shell/mailbox-page";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { FunnelSimpleIcon } from "@phosphor-icons/react";
import { getRouteApi } from "@tanstack/react-router";
import { useState } from "react";

const route = getRouteApi("/_dashboard/$mailboxId/$folder/");

export default function FolderPage() {
  const { mailboxId, folder } = route.useParams();

  if (folder === "archived") {
    return <ArchivedFolderPage mailboxId={mailboxId} />;
  }

  return <GenericFolderPage mailboxId={mailboxId} folder={folder as EmailFolderView} />;
}

function ArchivedFolderPage({ mailboxId }: { mailboxId: number }) {
  const emailData = useArchivedData({ mailboxId });
  return (
    <FolderView mailboxId={mailboxId} folder="archived" emailData={emailData} />
  );
}

function GenericFolderPage({
  mailboxId,
  folder,
}: {
  mailboxId: number;
  folder: EmailFolderView;
}) {
  const emailData = useMailViewData({ view: folder, mailboxId });
  return (
    <FolderView mailboxId={mailboxId} folder={folder} emailData={emailData} />
  );
}

function FolderView({
  mailboxId,
  folder,
  emailData,
}: {
  mailboxId: number;
  folder: EmailFolderView;
  emailData: ReturnType<typeof useMailViewData>;
}) {
  const queryClient = useQueryClient();
  const search = route.useSearch();
  const navigate = route.useNavigate();
  const isMobile = useIsMobile();
  const [showFilters, setShowFilters] = useState(false);
  const { openEmail, executeEmailAction, snooze } = useMailActions({
    view: folder,
    mailboxId,
    presentation: isMobile ? "route" : "panel",
  });

  const title = VIEW_LABELS[folder];
  const showFilterControls = emailData.hasEmails || emailData.hasActiveFilters;
  const filterBarVisible = showFilters || emailData.hasActiveFilters;
  const showReader = !isMobile;
  const handleSnooze = useThreadGroupSnooze(mailboxId, snooze);
  const {
    selectedEmailId,
    enableKeyboardNavigation,
    clearSelectedEmail,
    navigateSelectedEmail,
  } = useMailPanelSelection({
    isMobile,
    emailId: search.emailId,
    onClear: () =>
      navigate({
        to: "/$mailboxId/$folder",
        params: { mailboxId, folder },
        search: {},
        replace: true,
      }),
    onNavigate: (nextEmailId) =>
      navigate({
        to: "/$mailboxId/$folder",
        params: { mailboxId, folder },
        search: { emailId: nextEmailId },
        replace: true,
      }),
  });

  const listPane = (
    <div className="flex h-full min-h-0 min-w-0 flex-col">
      <MailboxPageHeader
        title={title}
        actions={
          <>
            {showFilterControls && filterBarVisible && isMobile && (
              <MailFilterBar
                filters={emailData.filters}
                onChange={emailData.setFilters}
                view={emailData.view}
                className="hidden md:flex"
              />
            )}
            {(folder === "spam" || folder === "trash") &&
              emailData.hasEmails && (
                <DeleteAllButton
                  folder={folder}
                  mailboxId={mailboxId}
                  onDeleted={() => {
                    queryClient.invalidateQueries({
                      queryKey: emailQueryKeys.list(folder, mailboxId),
                    });
                  }}
                />
              )}
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
                onClick={() => setShowFilters(!filterBarVisible)}
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
          className={cn("flex px-3 pb-1.5", isMobile && "md:hidden")}
        />
      )}
      <EmailList
        key={folder}
        emailData={emailData}
        onOpen={openEmail}
        onAction={executeEmailAction}
        onSnooze={handleSnooze}
        filterBarOpen={showFilters}
        onFilterBarOpenChange={setShowFilters}
        enableKeyboardNavigation={enableKeyboardNavigation}
        selectedEmailId={selectedEmailId}
        hideFilterControls
      />
    </div>
  );

  const readerPane = selectedEmailId ? (
    <EmailDetailView
      mailboxId={mailboxId}
      view={folder}
      emailId={selectedEmailId}
      onClose={clearSelectedEmail}
      onNavigateToEmail={navigateSelectedEmail}
      listGroups={emailData.threadGroups}
      hasNextPage={emailData.hasNextPage}
      isFetchingNextPage={emailData.isFetchingNextPage}
      fetchNextPage={emailData.fetchNextPage}
      embedded
    />
  ) : (
    <div className="flex h-full min-h-0 min-w-0 flex-col bg-background">
      <Empty>
        <EmptyHeader>
          <EmptyTitle>Select an email</EmptyTitle>
          <EmptyDescription>
            Open a message from {title.toLowerCase()} to read it here.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    </div>
  );

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
