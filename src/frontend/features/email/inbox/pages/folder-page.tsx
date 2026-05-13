import { useQueryClient } from "@tanstack/react-query";
import { useArchivedData } from "@/features/email/inbox/hooks/use-archived-data";
import { useMailPanelSelection } from "@/features/email/inbox/hooks/use-mail-panel-selection";
import { useThreadGroupSnooze } from "@/features/email/inbox/hooks/use-thread-group-snooze";
import {
  MailListReaderPage,
  MailListPane,
  MailReaderPane,
} from "@/features/email/inbox/pages/mail-pane";
import { useMailActions } from "@/features/email/mail/hooks/use-mail-actions";
import { useMailViewData } from "@/features/email/mail/hooks/use-mail-view-data";
import { emailQueryKeys } from "@/features/email/mail/query-keys";
import { DeleteAllButton } from "@/features/email/mail/list/delete-all-button";
import { VIEW_LABELS, type EmailFolderView } from "@/features/email/mail/views";
import { useIsMobile } from "@/hooks/use-mobile";
import { getRouteApi } from "@tanstack/react-router";
import { useState } from "react";

const route = getRouteApi("/_dashboard/$mailboxId/$folder/");

export default function FolderPage() {
  const { mailboxId, folder } = route.useParams();

  if (folder === "archived") {
    return <ArchivedFolderPage mailboxId={mailboxId} />;
  }

  return <GenericFolderPage mailboxId={mailboxId} folder={folder as EmailFolderView} />;
}

function ArchivedFolderPage({ mailboxId }: { mailboxId: number }) {
  const emailData = useArchivedData({ mailboxId });
  return (
    <FolderView mailboxId={mailboxId} folder="archived" emailData={emailData} />
  );
}

function GenericFolderPage({
  mailboxId,
  folder,
}: {
  mailboxId: number;
  folder: EmailFolderView;
}) {
  const emailData = useMailViewData({ view: folder, mailboxId });
  return (
    <FolderView mailboxId={mailboxId} folder={folder} emailData={emailData} />
  );
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
  const queryClient = useQueryClient();
  const search = route.useSearch();
  const navigate = route.useNavigate();
  const isMobile = useIsMobile();
  const [showFilters, setShowFilters] = useState(false);
  const { openEmail, executeEmailAction, snooze } = useMailActions({
    view: folder,
    mailboxId,
    presentation: isMobile ? "route" : "panel",
  });

  const title = VIEW_LABELS[folder];
  const handleSnooze = useThreadGroupSnooze(mailboxId, snooze);
  const {
    selectedEmailId,
    enableKeyboardNavigation,
    clearSelectedEmail,
    navigateSelectedEmail,
  } = useMailPanelSelection({
    isMobile,
    emailId: search.emailId,
    onClear: () =>
      navigate({
        to: "/$mailboxId/$folder",
        params: { mailboxId, folder },
        search: {},
        replace: true,
      }),
    onNavigate: (nextEmailId) =>
      navigate({
        to: "/$mailboxId/$folder",
        params: { mailboxId, folder },
        search: { emailId: nextEmailId },
        replace: true,
      }),
  });

  const listPane = (
    <MailListPane
      title={title}
      emailData={emailData}
      showFilters={showFilters}
      onShowFiltersChange={setShowFilters}
      onOpen={openEmail}
      onAction={executeEmailAction}
      onSnooze={handleSnooze}
      selectedEmailId={selectedEmailId}
      enableKeyboardNavigation={enableKeyboardNavigation}
      compact={!isMobile}
      headerExtraActions={
        (folder === "spam" || folder === "trash") && emailData.hasEmails ? (
          <DeleteAllButton
            folder={folder}
            mailboxId={mailboxId}
            onDeleted={() => {
              queryClient.invalidateQueries({
                queryKey: emailQueryKeys.list(folder, mailboxId),
              });
            }}
          />
        ) : null
      }
    />
  );

  return (
    <MailListReaderPage
      showReader={!isMobile && emailData.hasEmails}
      listPane={listPane}
      readerPane={
        <MailReaderPane
          mailboxId={mailboxId}
          view={folder}
          emailId={selectedEmailId}
          emptyDescription={`Open a message from ${title.toLowerCase()} to read it here.`}
          onClose={clearSelectedEmail}
          onNavigateToEmail={navigateSelectedEmail}
          listGroups={emailData.threadGroups}
          hasNextPage={emailData.hasNextPage}
          isFetchingNextPage={emailData.isFetchingNextPage}
          fetchNextPage={emailData.fetchNextPage}
        />
      }
    />
  );
}
