import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import {
  MailListPane,
  MailReaderPane,
} from "@/features/email/inbox/pages/mail-pane";
import { useMailViewData } from "@/features/email/mail/hooks/use-mail-view-data";
import { useMailActions } from "@/features/email/mail/hooks/use-mail-actions";
import { isInternalLabelName } from "@/features/email/labels/internal-labels";
import { fetchLabels } from "@/features/email/labels/queries";
import { labelQueryKeys } from "@/features/email/labels/query-keys";
import { MailboxPage } from "@/features/email/shell/mailbox-page";
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
  const { openEmail, executeEmailAction } = useMailActions({
    view: label,
    mailboxId,
    presentation: isMobile ? "route" : "panel",
  });
  const selectedEmailId = isMobile ? null : (search.emailId ?? null);

  const clearSelectedEmail = () =>
    navigate({
      to: "/$mailboxId/inbox/labels/$label",
      params: { mailboxId, label },
      search: {},
      replace: true,
    });

  const navigateSelectedEmail = (nextEmailId: string) =>
    navigate({
      to: "/$mailboxId/inbox/labels/$label",
      params: { mailboxId, label },
      search: { emailId: nextEmailId },
      replace: true,
    });

  const listPane = (
    <MailListPane
      title={labelName}
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
            view={label}
            emailId={selectedEmailId}
            emptyDescription={`Open a message from ${labelName.toLowerCase()} to read it here.`}
            onClose={clearSelectedEmail}
            onNavigateToEmail={navigateSelectedEmail}
          />
        </ResizablePanel>
      </ResizablePanelGroup>
    </MailboxPage>
  );
}
