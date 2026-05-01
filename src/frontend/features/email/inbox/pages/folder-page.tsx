import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { EmailList } from "@/features/email/inbox/components/list/email-list";
import { InboxFilterBar } from "@/features/email/inbox/components/list/inbox-filter-bar";
import { useArchivedData } from "@/features/email/inbox/hooks/use-archived-data";
import { useEmailData } from "@/features/email/inbox/hooks/use-email-data";
import { useEmailInboxActions } from "@/features/email/inbox/hooks/use-email-inbox-actions";
import { VIEW_LABELS } from "@/features/email/inbox/utils/inbox-filters";
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

  return <GenericFolderPage mailboxId={mailboxId} folder={folder} />;
}

function ArchivedFolderPage({ mailboxId }: { mailboxId: number }) {
  const emailData = useArchivedData({ mailboxId });
  return <FolderView mailboxId={mailboxId} folder="archived" emailData={emailData} />;
}

function GenericFolderPage({
  mailboxId,
  folder,
}: {
  mailboxId: number;
  folder: string;
}) {
  const emailData = useEmailData({ view: folder, mailboxId });
  return <FolderView mailboxId={mailboxId} folder={folder} emailData={emailData} />;
}

function FolderView({
  mailboxId,
  folder,
  emailData,
}: {
  mailboxId: number;
  folder: string;
  emailData: ReturnType<typeof useEmailData>;
}) {
  const [showFilters, setShowFilters] = useState(false);
  const { openEmail, executeEmailAction } = useEmailInboxActions({
    view: folder,
    mailboxId,
  });

  const title = (VIEW_LABELS as Record<string, string>)[folder] ?? folder;
  const showFilterControls = emailData.hasEmails || emailData.hasActiveFilters;
  const filterBarVisible = showFilters || emailData.hasActiveFilters;

  return (
    <>
      <PageHeader
        title={
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate">{title}</span>
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
