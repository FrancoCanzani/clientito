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
import { subscribeOpenInTab } from "@/features/email/inbox/hooks/tab-events";
import { useInboxData } from "@/features/email/inbox/hooks/use-inbox-data";
import {
  useReaderTabs,
  type ReaderTab,
} from "@/features/email/inbox/hooks/use-reader-tabs";
import { useThreadGroupSnooze } from "@/features/email/inbox/hooks/use-thread-group-snooze";
import { EmailDetailView } from "@/features/email/inbox/pages/email-detail-view";
import { ReaderTabs } from "@/features/email/inbox/reader/reader-tabs";
import { EmailList } from "@/features/email/mail/list/email-list";
import { MailFilterBar } from "@/features/email/mail/list/mail-filter-bar";
import { ViewSyncStatusControl } from "@/features/email/mail/list/view-sync-status";
import { fetchViewUnreadCounts } from "@/features/email/mail/shared/data/unread-counts";
import { useMailActions } from "@/features/email/mail/shared/hooks/use-mail-actions";
import { emailQueryKeys } from "@/features/email/mail/shared/query-keys";
import type { EmailListItem } from "@/features/email/mail/shared/types";
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
import { useEffect, useState } from "react";

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

  const selectedEmailId = isMobile ? null : (search.emailId ?? null);
  const enableKeyboardNavigation = !selectedEmailId;

  const setActiveTabId = (nextId: string | null) =>
    navigate({
      to: "/$mailboxId/inbox",
      params: { mailboxId },
      search: inboxSearch(inboxMode, nextId ?? undefined),
      replace: true,
    });

  const {
    pinned: pinnedTabs,
    ephemeral: ephemeralTab,
    openInActive,
    openInNew,
    close: closeTab,
    closeActive: closeActiveTab,
    closeOthers: closeOtherTabs,
    closeAll: closeAllTabs,
    pin: pinTab,
    switchTo: switchTab,
    switchByOffset: switchTabByOffset,
    updateSubject: updateTabSubject,
  } = useReaderTabs({
    mailboxId,
    activeId: selectedEmailId,
    setActiveId: setActiveTabId,
    enabled: !isMobile,
  });

  const handleOpen = (email: EmailListItem) => {
    openInActive(email);
    openEmail(email);
  };

  const handleOpenInTab = (email: EmailListItem) => {
    openInNew(email);
    openEmail(email);
  };

  const clearSelectedEmail = () => setActiveTabId(null);
  const navigateSelectedEmail = (nextEmailId: string) => {
    setActiveTabId(nextEmailId);
  };

  useEffect(() => {
    const candidates: ReaderTab[] = [...pinnedTabs];
    if (ephemeralTab) candidates.push(ephemeralTab);
    for (const tab of candidates) {
      if (tab.subject) continue;
      const group = emailData.threadGroups.find((g) =>
        g.emails.some((e) => e.id === tab.id),
      );
      const subject = group?.representative.subject?.trim();
      if (subject) updateTabSubject(tab.id, subject);
    }
  }, [pinnedTabs, ephemeralTab, emailData.threadGroups, updateTabSubject]);

  useEffect(() => {
    if (isMobile) return;
    return subscribeOpenInTab((emailId) => {
      const group = emailData.threadGroups.find((g) =>
        g.emails.some((e) => e.id === emailId),
      );
      const target =
        group?.emails.find((e) => e.id === emailId) ?? group?.representative;
      if (target) handleOpenInTab(target);
    });
  });

  const stripLength = pinnedTabs.length + (ephemeralTab ? 1 : 0);

  const gatekeeperPendingQuery = useGatekeeperPending(mailboxId, true);
  const pendingSendersCount = gatekeeperPendingQuery.data?.pendingCount ?? 0;
  const viewCountsQuery = useQuery({
    queryKey: emailQueryKeys.viewCounts(mailboxId),
    queryFn: () => fetchViewUnreadCounts(mailboxId),
    staleTime: 60_000,
  });
  const importantUnread = viewCountsQuery.data?.important.messagesUnread ?? 0;
  const inboxUnread = viewCountsQuery.data?.inbox.messagesUnread ?? 0;
  const fmtCount = (n: number) => (n > 99 ? "99+" : String(n));
  const showFilterControls = emailData.hasEmails || emailData.hasActiveFilters;
  const filterBarVisible = showFilters || emailData.hasActiveFilters;
  const showReader = !isMobile;
  const handleSnooze = useThreadGroupSnooze(mailboxId, snooze);

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
    <ButtonGroup
      aria-label="Inbox view"
      className="shrink-0 bg-gray-50 dark:bg-gray-950"
    >
      <Button
        type="button"
        size="sm"
        className="rounded-r-none"
        variant={inboxMode === "important" ? "secondary" : "ghost"}
        onClick={() => setInboxMode("important")}
        aria-pressed={inboxMode === "important"}
      >
        Important
        {importantUnread > 0 && (
          <span className="ml-1 text-xs tabular-nums">
            {fmtCount(importantUnread)}
          </span>
        )}
      </Button>
      <Button
        type="button"
        size="sm"
        className="rounded-l-none"
        variant={inboxMode === "all" ? "secondary" : "ghost"}
        onClick={() => setInboxMode("all")}
        aria-pressed={inboxMode === "all"}
      >
        All
        {inboxUnread > 0 && (
          <span className="ml-1 text-xs tabular-nums">
            {fmtCount(inboxUnread)}
          </span>
        )}
      </Button>
    </ButtonGroup>
  );

  const screenerButton =
    pendingSendersCount > 0 ? (
      <Button asChild variant="secondary" size={"sm"}>
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
        onOpen={isMobile ? openEmail : handleOpen}
        onOpenInTab={isMobile ? undefined : handleOpenInTab}
        onAction={executeEmailAction}
        onSnooze={handleSnooze}
        filterBarOpen={showFilters}
        onFilterBarOpenChange={setShowFilters}
        enableKeyboardNavigation={enableKeyboardNavigation}
        selectedEmailId={selectedEmailId}
        onNextTab={() => switchTabByOffset(1)}
        onPrevTab={() => switchTabByOffset(-1)}
        onCloseTab={() => closeActiveTab()}
        canSwitchTab={!isMobile && stripLength > 1}
        canCloseTab={!isMobile && Boolean(selectedEmailId)}
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

  const readerPane = (
    <div className="flex h-full min-h-0 min-w-0 flex-col bg-background">
      <ReaderTabs
        pinned={pinnedTabs}
        ephemeral={ephemeralTab}
        activeId={selectedEmailId}
        onSwitch={switchTab}
        onClose={closeTab}
        onPin={pinTab}
        onCloseOthers={closeOtherTabs}
        onCloseAll={closeAllTabs}
      />
      {selectedEmailId ? (
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
          onNextTab={() => switchTabByOffset(1)}
          onPrevTab={() => switchTabByOffset(-1)}
          onCloseTab={() => closeActiveTab()}
          canSwitchTab={!isMobile && stripLength > 1}
          canCloseTab={!isMobile && Boolean(selectedEmailId)}
        />
      ) : (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>Select an email</EmptyTitle>
            <EmptyDescription>
              Open a message from the inbox to read it here.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
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
