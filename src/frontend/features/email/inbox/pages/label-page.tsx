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
import { useMailPanelSelection } from "@/features/email/inbox/hooks/use-mail-panel-selection";
import { useThreadGroupSnooze } from "@/features/email/inbox/hooks/use-thread-group-snooze";
import { EmailDetailView } from "@/features/email/inbox/pages/email-detail-view";
import { isInternalLabelName } from "@/features/email/labels/internal-labels";
import { fetchLabels } from "@/features/email/labels/queries";
import { labelQueryKeys } from "@/features/email/labels/query-keys";
import { useMailActions } from "@/features/email/mail/shared/hooks/use-mail-actions";
import { useMailViewData } from "@/features/email/mail/shared/hooks/use-mail-view-data";
import { EmailList } from "@/features/email/mail/list/email-list";
import { MailFilterBar } from "@/features/email/mail/list/mail-filter-bar";
import { ViewSyncStatusControl } from "@/features/email/mail/list/view-sync-status";
import {
  MailboxPage,
  MailboxPageHeader,
} from "@/features/email/shell/mailbox-page";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { FunnelSimpleIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { useState } from "react";

const route = getRouteApi("/_dashboard/$mailboxId/inbox/labels/$label/");

export default function LabelPage() {
  const { mailboxId, label } = route.useParams();
  const search = route.useSearch();
  const navigate = route.useNavigate();
  const isMobile = useIsMobile();
  const emailData = useMailViewData({ view: label, mailboxId });
  const [showFilters, setShowFilters] = useState(false);
  const labelsQuery = useQuery({
    queryKey: labelQueryKeys.list(mailboxId),
    queryFn: () => fetchLabels(mailboxId),
    staleTime: 60_000,
  });
  const labelName =
    labelsQuery.data
      ?.filter((label) => !isInternalLabelName(label.name))
      .find((l) => l.gmailId === label)?.name ?? label;
  const { openEmail, executeEmailAction, snooze } = useMailActions({
    view: label,
    mailboxId,
    presentation: isMobile ? "route" : "panel",
  });
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
        to: "/$mailboxId/inbox/labels/$label",
        params: { mailboxId, label },
        search: {},
        replace: true,
      }),
    onNavigate: (nextEmailId) =>
      navigate({
        to: "/$mailboxId/inbox/labels/$label",
        params: { mailboxId, label },
        search: { emailId: nextEmailId },
        replace: true,
      }),
  });

  const listPane = (
    <div className="flex h-full min-h-0 min-w-0 flex-col">
      <MailboxPageHeader
        title={labelName}
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
        key={label}
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
      view={label}
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
            Open a message from {labelName.toLowerCase()} to read it here.
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
