import { Button } from "@/components/ui/button";
import { EmailList } from "@/features/email/mail/list/email-list";
import { MailFilterBar } from "@/features/email/mail/list/mail-filter-bar";
import { useArchivedData } from "@/features/email/inbox/hooks/use-archived-data";
import { useMailViewData } from "@/features/email/mail/hooks/use-mail-view-data";
import { useMailActions } from "@/features/email/mail/hooks/use-mail-actions";
import { VIEW_LABELS } from "@/features/email/mail/views";
import {
  MailboxPage,
  MailboxPageHeader,
} from "@/features/email/shell/mailbox-page";
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
  const emailData = useMailViewData({ view: folder, mailboxId });
  return <FolderView mailboxId={mailboxId} folder={folder} emailData={emailData} />;
}

function FolderView({
  mailboxId,
  folder,
  emailData,
}: {
  mailboxId: number;
  folder: string;
  emailData: ReturnType<typeof useMailViewData>;
}) {
  const [showFilters, setShowFilters] = useState(false);
  const { openEmail, executeEmailAction } = useMailActions({
    view: folder,
    mailboxId,
  });

  const title = (VIEW_LABELS as Record<string, string>)[folder] ?? folder;
  const showFilterControls = emailData.hasEmails || emailData.hasActiveFilters;
  const filterBarVisible = showFilters || emailData.hasActiveFilters;

  return (
    <MailboxPage>
      <MailboxPageHeader
        title={title}
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
