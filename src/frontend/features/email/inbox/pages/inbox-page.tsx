import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
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
import { FocusWindowToggle } from "@/features/email/focus-window/focus-window-toggle";
import { useGatekeeperPending } from "@/features/email/gatekeeper/queries";
import { useInboxData } from "@/features/email/inbox/hooks/use-inbox-data";
import { useMailPanelSelection } from "@/features/email/inbox/hooks/use-mail-panel-selection";
import { useThreadGroupSnooze } from "@/features/email/inbox/hooks/use-thread-group-snooze";
import { EmailDetailView } from "@/features/email/inbox/pages/email-detail-view";
import { fetchViewUnreadCounts } from "@/features/email/mail/data/unread-counts";
import { useMailActions } from "@/features/email/mail/hooks/use-mail-actions";
import { EmailList } from "@/features/email/mail/list/email-list";
import { MailFilterBar } from "@/features/email/mail/list/mail-filter-bar";
import { ViewSyncStatusControl } from "@/features/email/mail/list/view-sync-status";
import { emailQueryKeys } from "@/features/email/mail/query-keys";
import { InboxViewBar } from "@/features/email/shell/inbox-view-bar";
import {
  MailboxPage,
  MailboxPageHeader,
} from "@/features/email/shell/mailbox-page";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { FunnelSimpleIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { Link, getRouteApi } from "@tanstack/react-router";
import { useState } from "react";

const route = getRouteApi("/_dashboard/$mailboxId/inbox/");

type InboxMode = "important" | "all";
type InboxSearch = { emailId?: string; mode?: InboxMode };

function inboxSearch(mode: InboxMode, emailId?: string): InboxSearch {
  return {
    ...(emailId ? { emailId } : {}),
    ...(mode === "all" ? { mode } : {}),
  };
}

export default function InboxPage() {
  const { mailboxId } = route.useParams();
  const search = route.useSearch();
  const navigate = route.useNavigate();
  const isMobile = useIsMobile();
  const [showFilters, setShowFilters] = useState(false);
  const inboxMode: InboxMode = search.mode === "all" ? "all" : "important";
  const view = inboxMode === "all" ? "inbox" : "important";
  const emailData = useInboxData({ mailboxId, view });
  const { openEmail, executeEmailAction, snooze } = useMailActions({
    view,
    mailboxId,
    openContext: "inbox",
    inboxMode,
    presentation: isMobile ? "route" : "panel",
  });

  const gatekeeperPendingQuery = useGatekeeperPending(mailboxId, true);
  const pendingSendersCount = gatekeeperPendingQuery.data?.pendingCount ?? 0;
  const viewCountsQuery = useQuery({
    queryKey: emailQueryKeys.viewCounts(mailboxId),
    queryFn: () => fetchViewUnreadCounts(mailboxId),
    staleTime: 60_000,
  });
  const importantUnread =
    viewCountsQuery.data?.important.messagesUnread ?? 0;
  const inboxUnread = viewCountsQuery.data?.inbox.messagesUnread ?? 0;
  const fmtCount = (n: number) => (n > 99 ? "99+" : String(n));
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
        to: "/$mailboxId/inbox",
        params: { mailboxId },
        search: inboxSearch(inboxMode),
        replace: true,
      }),
    onNavigate: (nextEmailId) =>
      navigate({
        to: "/$mailboxId/inbox",
        params: { mailboxId },
        search: inboxSearch(inboxMode, nextEmailId),
        replace: true,
      }),
  });

  const setInboxMode = (nextMode: InboxMode) => {
    if (nextMode === inboxMode) return;
    navigate({
      to: "/$mailboxId/inbox",
      params: { mailboxId },
      search: inboxSearch(nextMode),
      replace: true,
    });
  };

  const modeTabs = (
    <ButtonGroup aria-label="Inbox view" className="shrink-0">
      <Button
        type="button"
        size="sm"
        variant={inboxMode === "important" ? "default" : "outline"}
        onClick={() => setInboxMode("important")}
        aria-pressed={inboxMode === "important"}
      >
        Important
        {importantUnread > 0 && (
          <span className="ml-1 text-xs tabular-nums text-muted-foreground">
            {fmtCount(importantUnread)}
          </span>
        )}
      </Button>
      <Button
        type="button"
        size="sm"
        variant={inboxMode === "all" ? "default" : "outline"}
        onClick={() => setInboxMode("all")}
        aria-pressed={inboxMode === "all"}
      >
        All
        {inboxUnread > 0 && (
          <span className="ml-1 text-xs tabular-nums text-muted-foreground">
            {fmtCount(inboxUnread)}
          </span>
        )}
      </Button>
    </ButtonGroup>
  );

  const screenerButton =
    pendingSendersCount > 0 ? (
      <Button asChild variant="secondary">
        <Link
          to="/$mailboxId/screener"
          params={{ mailboxId }}
          preload="viewport"
          className="inline-flex items-center gap-1.5"
        >
          <span>Screened</span>
          <span className="text-xs tabular-nums text-muted-foreground">
            {pendingSendersCount}
          </span>
        </Link>
      </Button>
    ) : null;

  const listPane = (
    <div className="flex h-full min-h-0 min-w-0 flex-col">
      <MailboxPageHeader
        title="Inbox"
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
            {modeTabs}
            <InboxViewBar />
            <FocusWindowToggle />
            {screenerButton}
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
        key={view}
        emailData={emailData}
        onOpen={openEmail}
        onAction={executeEmailAction}
        onSnooze={handleSnooze}
        filterBarOpen={showFilters}
        onFilterBarOpenChange={setShowFilters}
        enableKeyboardNavigation={enableKeyboardNavigation}
        selectedEmailId={selectedEmailId}
        emptyTitle={inboxMode === "important" ? "No important mail" : undefined}
        emptyDescription={
          inboxMode === "important"
            ? "Messages Gmail marks as important will show up here."
            : undefined
        }
        hideFilterControls
      />
    </div>
  );

  const readerPane = selectedEmailId ? (
    <EmailDetailView
      mailboxId={mailboxId}
      view="inbox"
      inboxMode={inboxMode}
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
            Open a message from the inbox to read it here.
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
