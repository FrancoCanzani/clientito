import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import {
  MailListPane,
  MailReaderPane,
} from "@/features/email/inbox/pages/mail-pane";
import { useArchivedData } from "@/features/email/inbox/hooks/use-archived-data";
import { useMailViewData } from "@/features/email/mail/hooks/use-mail-view-data";
import { useMailActions } from "@/features/email/mail/hooks/use-mail-actions";
import { VIEW_LABELS, type EmailFolderView } from "@/features/email/mail/views";
import { MailboxPage } from "@/features/email/shell/mailbox-page";
import { useIsMobile } from "@/hooks/use-mobile";
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
  folder: EmailFolderView;
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
  folder: EmailFolderView;
  emailData: ReturnType<typeof useMailViewData>;
}) {
  const search = route.useSearch();
  const navigate = route.useNavigate();
  const isMobile = useIsMobile();
  const [showFilters, setShowFilters] = useState(false);
  const { openEmail, executeEmailAction } = useMailActions({
    view: folder,
    mailboxId,
    presentation: isMobile ? "route" : "panel",
  });

  const title = (VIEW_LABELS as Record<string, string>)[folder] ?? folder;
  const selectedEmailId = isMobile ? null : (search.emailId ?? null);

  const clearSelectedEmail = () =>
    navigate({
      to: "/$mailboxId/$folder",
      params: { mailboxId, folder },
      search: {},
      replace: true,
    });

  const navigateSelectedEmail = (nextEmailId: string) =>
    navigate({
      to: "/$mailboxId/$folder",
      params: { mailboxId, folder },
      search: { emailId: nextEmailId },
      replace: true,
    });

  const listPane = (
    <MailListPane
      title={title}
      emailData={emailData}
      showFilters={showFilters}
      onShowFiltersChange={setShowFilters}
      onOpen={openEmail}
      onAction={executeEmailAction}
      selectedEmailId={selectedEmailId}
      enableKeyboardNavigation={!selectedEmailId}
      compact={!isMobile}
    />
  );

  if (isMobile) {
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
          <MailReaderPane
            mailboxId={mailboxId}
            view={folder}
            emailId={selectedEmailId}
            emptyDescription={`Open a message from ${title.toLowerCase()} to read it here.`}
            onClose={clearSelectedEmail}
            onNavigateToEmail={navigateSelectedEmail}
          />
        </ResizablePanel>
      </ResizablePanelGroup>
    </MailboxPage>
  );
}
