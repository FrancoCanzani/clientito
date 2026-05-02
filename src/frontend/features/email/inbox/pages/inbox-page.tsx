import { Button } from "@/components/ui/button";
import { useGatekeeperPending } from "@/features/email/gatekeeper/queries";
import { EmailList } from "@/features/email/mail/list/email-list";
import { MailFilterBar } from "@/features/email/mail/list/mail-filter-bar";
import { useMailActions } from "@/features/email/mail/hooks/use-mail-actions";
import { useInboxData } from "@/features/email/inbox/hooks/use-inbox-data";
import {
  MailboxPage,
  MailboxPageHeader,
} from "@/features/email/shell/mailbox-page";
import { cn } from "@/lib/utils";
import { FunnelSimpleIcon } from "@phosphor-icons/react";
import { Link, getRouteApi } from "@tanstack/react-router";
import { useState } from "react";

const route = getRouteApi("/_dashboard/$mailboxId/inbox/");

export default function InboxPage() {
  const { mailboxId } = route.useParams();
  const [showFilters, setShowFilters] = useState(false);
  const emailData = useInboxData({ mailboxId });
  const { openEmail, executeEmailAction } = useMailActions({
    view: "inbox",
    mailboxId,
  });

  const gatekeeperPendingQuery = useGatekeeperPending(mailboxId, true);
  const pendingSendersCount = gatekeeperPendingQuery.data?.pendingCount ?? 0;
  const showScreener = pendingSendersCount > 0;

  const showFilterControls = emailData.hasEmails || emailData.hasActiveFilters;
  const filterBarVisible = showFilters || emailData.hasActiveFilters;

  return (
    <MailboxPage>
      <MailboxPageHeader
        title="Inbox"
        actions={
          <>
            {showFilterControls && filterBarVisible ? (
              <MailFilterBar
                filters={emailData.filters}
                onChange={emailData.setFilters}
                view={emailData.view}
                className="hidden md:flex"
              />
            ) : null}
            {showScreener ? (
              <Button asChild variant="outline" size="sm">
                <Link
                  to="/$mailboxId/screener"
                  params={{ mailboxId }}
                  preload="viewport"
                  className="inline-flex items-center gap-1.5"
                >
                  <span>Screener</span>
                  <span className="text-xs text-muted-foreground">
                    {pendingSendersCount}
                  </span>
                </Link>
              </Button>
            ) : null}
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
          </>
        }
      />
      {showFilterControls && filterBarVisible ? (
        <MailFilterBar
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
    </MailboxPage>
  );
}
