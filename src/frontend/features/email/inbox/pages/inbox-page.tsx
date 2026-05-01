import { Button } from "@/components/ui/button";
import { useGatekeeperPending } from "@/features/email/gatekeeper/queries";
import { EmailList } from "@/features/email/inbox/components/list/email-list";
import { InboxFilterBar } from "@/features/email/inbox/components/list/inbox-filter-bar";
import { useEmailInboxActions } from "@/features/email/inbox/hooks/use-email-inbox-actions";
import { useInboxData } from "@/features/email/inbox/hooks/use-inbox-data";
import { cn } from "@/lib/utils";
import { FunnelSimpleIcon } from "@phosphor-icons/react";
import { Link, getRouteApi } from "@tanstack/react-router";
import { useState } from "react";

const route = getRouteApi("/_dashboard/$mailboxId/inbox/");

export default function InboxPage() {
  const { mailboxId } = route.useParams();
  const [showFilters, setShowFilters] = useState(false);
  const emailData = useInboxData({ mailboxId });
  const { openEmail, executeEmailAction } = useEmailInboxActions({
    view: "inbox",
    mailboxId,
  });

  const gatekeeperPendingQuery = useGatekeeperPending(mailboxId, true);
  const pendingSendersCount = gatekeeperPendingQuery.data?.pendingCount ?? 0;

  const showFilterControls = emailData.hasEmails || emailData.hasActiveFilters;
  const filterBarVisible = showFilters || emailData.hasActiveFilters;

  return (
    <>
      <div className="flex min-h-10 shrink-0 items-center justify-between gap-3 border-b border-border/40 px-3 py-1.5 md:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <h1 className="shrink-0 text-sm font-medium text-foreground">
            Inbox
          </h1>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {showFilterControls && filterBarVisible ? (
            <InboxFilterBar
              filters={emailData.filters}
              onChange={emailData.setFilters}
              view={emailData.view}
              className="hidden md:flex"
            />
          ) : null}
          <Button asChild variant="outline" size="sm">
            <Link
              to="/$mailboxId/screener"
              params={{ mailboxId }}
              preload="viewport"
              className="inline-flex items-center gap-1.5"
            >
              <span>Screener</span>
              {pendingSendersCount > 0 ? (
                <span className="text-xs text-muted-foreground">
                  {pendingSendersCount}
                </span>
              ) : null}
            </Link>
          </Button>
          {showFilterControls ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowFilters((visible) => !visible)}
              aria-pressed={filterBarVisible}
              className={cn("gap-1.5", filterBarVisible && "bg-muted")}
            >
              <FunnelSimpleIcon className="size-3.5" />
              <span>Filter</span>
            </Button>
          ) : null}
        </div>
      </div>
      {showFilterControls && filterBarVisible ? (
        <InboxFilterBar
          filters={emailData.filters}
          onChange={emailData.setFilters}
          view={emailData.view}
          className="flex px-3 pb-1.5 md:hidden"
        />
      ) : null}
      <EmailList
        emailData={emailData}
        onOpen={openEmail}
        onAction={executeEmailAction}
        filterBarOpen={showFilters}
        onFilterBarOpenChange={setShowFilters}
        hideFilterControls
      />
    </>
  );
}
