import { Button } from "@/components/ui/button";
import { EmailList } from "@/features/email/mail/list/email-list";
import { MailFilterBar } from "@/features/email/mail/list/mail-filter-bar";
import { useMailViewData } from "@/features/email/mail/hooks/use-mail-view-data";
import { useMailActions } from "@/features/email/mail/hooks/use-mail-actions";
import { isInternalLabelName } from "@/features/email/labels/internal-labels";
import { fetchLabels } from "@/features/email/labels/queries";
import { labelQueryKeys } from "@/features/email/labels/query-keys";
import {
  MailboxPage,
  MailboxPageHeader,
} from "@/features/email/shell/mailbox-page";
import { cn } from "@/lib/utils";
import { FunnelSimpleIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { useState } from "react";

const route = getRouteApi("/_dashboard/$mailboxId/inbox/labels/$label/");

export default function LabelPage() {
  const { mailboxId, label } = route.useParams();
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
  const { openEmail, executeEmailAction } = useMailActions({
    view: label,
    mailboxId,
  });
  const showFilterControls = emailData.hasEmails || emailData.hasActiveFilters;
  const filterBarVisible = showFilters || emailData.hasActiveFilters;

  return (
    <MailboxPage>
      <MailboxPageHeader
        title={labelName}
        actions={
          showFilterControls ? (
            <>
              {filterBarVisible ? (
                <MailFilterBar
                  filters={emailData.filters}
                  onChange={emailData.setFilters}
                  view={emailData.view}
                  className="hidden md:flex"
                />
              ) : null}
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
            </>
          ) : null
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
