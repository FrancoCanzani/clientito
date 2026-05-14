import { Button } from "@/components/ui/button";
import { PageSpinner } from "@/components/page-spinner";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import type { SplitRule } from "@/db/schema";
import { useThreadGroupSnooze } from "@/features/email/inbox/hooks/use-thread-group-snooze";
import { useMailActions } from "@/features/email/mail/hooks/use-mail-actions";
import { useMailViewData } from "@/features/email/mail/hooks/use-mail-view-data";
import { EmailList } from "@/features/email/mail/list/email-list";
import { MailFilterBar } from "@/features/email/mail/list/mail-filter-bar";
import { ViewSyncStatusControl } from "@/features/email/mail/list/view-sync-status";
import {
  MailboxPage,
  MailboxPageBody,
  MailboxPageHeader,
} from "@/features/email/shell/mailbox-page";
import {
  fetchSplitViews,
  getPrimarySplitViewLabelId,
} from "@/features/email/split-views/queries";
import { splitViewQueryKeys } from "@/features/email/split-views/query-keys";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { FunnelSimpleIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { useMemo, useState } from "react";

const route = getRouteApi("/_dashboard/$mailboxId/views/$viewId/");

export default function SplitViewPage() {
  const { mailboxId, viewId } = route.useParams();
  const splitViewsQuery = useQuery({
    queryKey: splitViewQueryKeys.all(),
    queryFn: fetchSplitViews,
    staleTime: 60_000,
  });
  const splitView = useMemo(
    () => splitViewsQuery.data?.find((view) => view.id === viewId) ?? null,
    [splitViewsQuery.data, viewId],
  );
  const labelId = getPrimarySplitViewLabelId(splitView);

  if (splitViewsQuery.isPending) {
    return (
      <MailboxPage>
        <MailboxPageBody>
          <PageSpinner />
        </MailboxPageBody>
      </MailboxPage>
    );
  }

  if (!splitView || !splitView.rules) {
    return (
      <MailboxPage>
        <MailboxPageBody>
          <Empty>
            <EmptyHeader>
              <EmptyTitle>View unavailable</EmptyTitle>
              <EmptyDescription>
                This view could not be loaded.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </MailboxPageBody>
      </MailboxPage>
    );
  }

  return (
    <SplitViewContent
      mailboxId={mailboxId}
      title={splitView.name}
      view={labelId ?? "inbox"}
      splitRule={splitView.rules}
    />
  );
}

function SplitViewContent({
  mailboxId,
  title,
  view,
  splitRule,
}: {
  mailboxId: number;
  title: string;
  view: string;
  splitRule: SplitRule | null;
}) {
  const [showFilters, setShowFilters] = useState(false);
  const isMobile = useIsMobile();
  const emailData = useMailViewData({ view, mailboxId, splitRule });
  const { openEmail, executeEmailAction, snooze } = useMailActions({
    view,
    mailboxId,
  });
  const handleSnooze = useThreadGroupSnooze(mailboxId, snooze);
  const showFilterControls = emailData.hasEmails || emailData.hasActiveFilters;
  const filterBarVisible = showFilters || emailData.hasActiveFilters;

  return (
    <MailboxPage className="max-w-none">
      <div className="flex h-full min-h-0 min-w-0 flex-col">
        <MailboxPageHeader
          title={title}
          actions={
            <>
              {showFilterControls && filterBarVisible && (
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
            className="flex px-3 pb-1.5 md:hidden"
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
          hideFilterControls
        />
      </div>
    </MailboxPage>
  );
}
