import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { useGatekeeperPending } from "@/features/email/gatekeeper/queries";
import { useInboxData } from "@/features/email/inbox/hooks/use-inbox-data";
import {
  MailListPane,
  MailReaderPane,
} from "@/features/email/inbox/pages/mail-pane";
import { useMailActions } from "@/features/email/mail/hooks/use-mail-actions";
import { MailboxPage } from "@/features/email/shell/mailbox-page";
import { useIsMobile } from "@/hooks/use-mobile";
import { Link, getRouteApi } from "@tanstack/react-router";
import { useState } from "react";

const route = getRouteApi("/_dashboard/$mailboxId/inbox/");
type InboxMode = "important" | "all";

export default function InboxPage() {
  const { mailboxId } = route.useParams();
  const search = route.useSearch();
  const navigate = route.useNavigate();
  const isMobile = useIsMobile();
  const [showFilters, setShowFilters] = useState(false);
  const inboxMode: InboxMode = search.mode === "all" ? "all" : "important";
  const view = inboxMode === "all" ? "inbox" : "important";
  const emailData = useInboxData({ mailboxId, view });
  const { openEmail, executeEmailAction, snooze } = useMailActions({
    view,
    mailboxId,
    openContext: "inbox",
    inboxMode,
    presentation: isMobile ? "route" : "panel",
  });

  const gatekeeperPendingQuery = useGatekeeperPending(mailboxId, true);
  const pendingSendersCount = gatekeeperPendingQuery.data?.pendingCount ?? 0;
  const selectedEmailId = isMobile ? null : (search.emailId ?? null);

  const clearSelectedEmail = () =>
    navigate({
      to: "/$mailboxId/inbox",
      params: { mailboxId },
      search: inboxMode === "all" ? { mode: "all" } : {},
      replace: true,
    });

  const navigateSelectedEmail = (nextEmailId: string) =>
    navigate({
      to: "/$mailboxId/inbox",
      params: { mailboxId },
      search: {
        emailId: nextEmailId,
        ...(inboxMode === "all" ? { mode: "all" as const } : {}),
      },
      replace: true,
    });

  const setInboxMode = (nextMode: InboxMode) => {
    if (nextMode === inboxMode) return;
    navigate({
      to: "/$mailboxId/inbox",
      params: { mailboxId },
      search: nextMode === "all" ? { mode: "all" } : {},
      replace: true,
    });
  };

  const modeTabs = (
    <ButtonGroup aria-label="Inbox view" className="shrink-0">
      <Button
        type="button"
        size="sm"
        variant={inboxMode === "important" ? "default" : "outline"}
        onClick={() => setInboxMode("important")}
        aria-pressed={inboxMode === "important"}
      >
        Important
      </Button>
      <Button
        type="button"
        size="sm"
        variant={inboxMode === "all" ? "default" : "outline"}
        onClick={() => setInboxMode("all")}
        aria-pressed={inboxMode === "all"}
      >
        All
      </Button>
    </ButtonGroup>
  );

  const screenerButton =
    pendingSendersCount > 0 ? (
      <Button asChild variant="secondary">
        <Link
          to="/$mailboxId/screener"
          params={{ mailboxId }}
          preload="viewport"
          className="inline-flex items-center gap-1.5"
        >
          <span>Screened</span>
          <span className="text-xs tabular-nums text-muted-foreground">
            {pendingSendersCount}
          </span>
        </Link>
      </Button>
    ) : null;

  const listPane = (
    <MailListPane
      title="Inbox"
      emailData={emailData}
      showFilters={showFilters}
      onShowFiltersChange={setShowFilters}
      onOpen={openEmail}
      onAction={executeEmailAction}
      onSnooze={(group, timestamp) =>
        group.threadId && group.representative.mailboxId
          ? void snooze(
              {
                kind: "thread",
                thread: {
                  threadId: group.threadId,
                  mailboxId: group.representative.mailboxId,
                  labelIds: group.representative.labelIds,
                },
              },
              timestamp,
            )
          : void snooze(
              {
                kind: "email",
                identifier: {
                  id: group.representative.id,
                  providerMessageId: group.representative.providerMessageId,
                  mailboxId: group.representative.mailboxId ?? mailboxId,
                  labelIds: group.representative.labelIds,
                },
              },
              timestamp,
            )
      }
      selectedEmailId={selectedEmailId}
      enableKeyboardNavigation={!selectedEmailId}
      compact={!isMobile}
      headerExtraActions={
        <>
          {modeTabs}
          {screenerButton}
        </>
      }
      emptyTitle={inboxMode === "important" ? "No important mail" : undefined}
      emptyDescription={
        inboxMode === "important"
          ? "Messages Gmail marks as important will show up here."
          : undefined
      }
    />
  );

  if (isMobile || !emailData.hasEmails) {
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
            view="inbox"
            inboxMode={inboxMode}
            emailId={selectedEmailId}
            emptyDescription="Open a message from the inbox to read it here."
            onClose={clearSelectedEmail}
            onNavigateToEmail={navigateSelectedEmail}
            listGroups={emailData.threadGroups}
            hasNextPage={emailData.hasNextPage}
            isFetchingNextPage={emailData.isFetchingNextPage}
            fetchNextPage={emailData.fetchNextPage}
          />
        </ResizablePanel>
      </ResizablePanelGroup>
    </MailboxPage>
  );
}
