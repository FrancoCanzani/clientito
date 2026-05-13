import { useMailPanelSelection } from "@/features/email/inbox/hooks/use-mail-panel-selection";
import { useThreadGroupSnooze } from "@/features/email/inbox/hooks/use-thread-group-snooze";
import {
  MailListReaderPage,
  MailListPane,
  MailReaderPane,
} from "@/features/email/inbox/pages/mail-pane";
import { isInternalLabelName } from "@/features/email/labels/internal-labels";
import { fetchLabels } from "@/features/email/labels/queries";
import { labelQueryKeys } from "@/features/email/labels/query-keys";
import { useMailActions } from "@/features/email/mail/hooks/use-mail-actions";
import { useMailViewData } from "@/features/email/mail/hooks/use-mail-view-data";
import { useIsMobile } from "@/hooks/use-mobile";
import { useQuery } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { useState } from "react";

const route = getRouteApi("/_dashboard/$mailboxId/inbox/labels/$label/");

export default function LabelPage() {
  const { mailboxId, label } = route.useParams();
  const search = route.useSearch();
  const navigate = route.useNavigate();
  const isMobile = useIsMobile();
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
  const { openEmail, executeEmailAction, snooze } = useMailActions({
    view: label,
    mailboxId,
    presentation: isMobile ? "route" : "panel",
  });
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
        to: "/$mailboxId/inbox/labels/$label",
        params: { mailboxId, label },
        search: {},
        replace: true,
      }),
    onNavigate: (nextEmailId) =>
      navigate({
        to: "/$mailboxId/inbox/labels/$label",
        params: { mailboxId, label },
        search: { emailId: nextEmailId },
        replace: true,
      }),
  });

  const listPane = (
    <MailListPane
      title={labelName}
      emailData={emailData}
      showFilters={showFilters}
      onShowFiltersChange={setShowFilters}
      onOpen={openEmail}
      onAction={executeEmailAction}
      onSnooze={handleSnooze}
      selectedEmailId={selectedEmailId}
      enableKeyboardNavigation={enableKeyboardNavigation}
      compact={!isMobile}
    />
  );

  return (
    <MailListReaderPage
      showReader={!isMobile && emailData.hasEmails}
      listPane={listPane}
      readerPane={
        <MailReaderPane
          mailboxId={mailboxId}
          view={label}
          emailId={selectedEmailId}
          emptyDescription={`Open a message from ${labelName.toLowerCase()} to read it here.`}
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
