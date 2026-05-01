import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { EmailList } from "@/features/email/inbox/components/list/email-list";
import { InboxFilterBar } from "@/features/email/inbox/components/list/inbox-filter-bar";
import { useEmailData } from "@/features/email/inbox/hooks/use-email-data";
import { useEmailInboxActions } from "@/features/email/inbox/hooks/use-email-inbox-actions";
import { isInternalLabelName } from "@/features/email/labels/internal-labels";
import { fetchLabels } from "@/features/email/labels/queries";
import { labelQueryKeys } from "@/features/email/labels/query-keys";
import { cn } from "@/lib/utils";
import { FunnelSimpleIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { useState } from "react";

const route = getRouteApi("/_dashboard/$mailboxId/inbox/labels/$label/");

export default function LabelPage() {
  const { mailboxId, label } = route.useParams();
  const emailData = useEmailData({ view: label, mailboxId });
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
  const { openEmail, executeEmailAction } = useEmailInboxActions({
    view: label,
    mailboxId,
  });
  const showFilterControls = emailData.hasEmails || emailData.hasActiveFilters;
  const filterBarVisible = showFilters || emailData.hasActiveFilters;

  return (
    <>
      <PageHeader
        title={
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate">{labelName}</span>
          </span>
        }
        actions={
          showFilterControls ? (
            <>
              {filterBarVisible ? (
                <InboxFilterBar
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
