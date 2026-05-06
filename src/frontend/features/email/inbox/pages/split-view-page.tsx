import { Button } from "@/components/ui/button";
import type { SplitRule } from "@/db/schema";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { EmailList } from "@/features/email/mail/list/email-list";
import { MailFilterBar } from "@/features/email/mail/list/mail-filter-bar";
import { ViewSyncStatusControl } from "@/features/email/mail/list/view-sync-status";
import { useMailActions } from "@/features/email/mail/hooks/use-mail-actions";
import { useMailViewData } from "@/features/email/mail/hooks/use-mail-view-data";
import {
  fetchSplitViews,
  getPrimarySplitViewLabelId,
} from "@/features/email/split-views/queries";
import { splitViewQueryKeys } from "@/features/email/split-views/query-keys";
import {
  MailboxPage,
  MailboxPageBody,
  MailboxPageHeader,
} from "@/features/email/shell/mailbox-page";
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
        <MailboxPageBody className="flex items-center justify-center px-6 text-sm text-muted-foreground">
          Loading view…
        </MailboxPageBody>
      </MailboxPage>
    );
  }

  if (!splitView || !splitView.rules) {
    return (
      <MailboxPage>
        <MailboxPageBody className="flex items-center justify-center">
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
  const emailData = useMailViewData({ view, mailboxId, splitRule });
  const { openEmail, executeEmailAction } = useMailActions({
    view,
    mailboxId,
  });
  const showFilterControls = emailData.hasEmails || emailData.hasActiveFilters;
  const filterBarVisible = showFilters || emailData.hasActiveFilters;

  return (
    <MailboxPage className="max-w-none">
      <MailboxPageHeader
        title={title}
        actions={
          <>
            <ViewSyncStatusControl
              status={emailData.syncStatus}
              onRefresh={() => emailData.refreshView()}
              disabled={emailData.isRefreshingView}
            />
            {showFilterControls && (
              <>
                {filterBarVisible && (
                  <MailFilterBar
                    filters={emailData.filters}
                    onChange={emailData.setFilters}
                    view={emailData.view}
                    className="hidden md:flex"
                  />
                )}
                <Button
                  variant="ghost"
                  onClick={() => setShowFilters((visible) => !visible)}
                  aria-pressed={filterBarVisible}
                  className={cn("gap-1.5", filterBarVisible && "bg-muted")}
                >
                  <FunnelSimpleIcon className="size-3.5" />
                </Button>
              </>
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
        emailData={emailData}
        onOpen={openEmail}
        onAction={executeEmailAction}
        filterBarOpen={showFilters}
        onFilterBarOpenChange={setShowFilters}
        hideFilterControls
      />
    </MailboxPage>
  );
}
