import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { useGatekeeperPending } from "@/features/email/gatekeeper/queries";
import { useInboxData } from "@/features/email/inbox/hooks/use-inbox-data";
import {
  MailListReaderPage,
  MailListPane,
  MailReaderPane,
  useThreadGroupSnooze,
} from "@/features/email/inbox/pages/mail-pane";
import { useMailActions } from "@/features/email/mail/hooks/use-mail-actions";
import { useIsMobile } from "@/hooks/use-mobile";
import { Link, getRouteApi } from "@tanstack/react-router";
import { useState } from "react";

const route = getRouteApi("/_dashboard/$mailboxId/inbox/");
type InboxMode = "important" | "all";
type InboxSearch = { emailId?: string; mode?: InboxMode };

function inboxSearch(mode: InboxMode, emailId?: string): InboxSearch {
  return {
    ...(emailId ? { emailId } : {}),
    ...(mode === "all" ? { mode } : {}),
  };
}

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
  const handleSnooze = useThreadGroupSnooze(mailboxId, snooze);

  const clearSelectedEmail = () =>
    navigate({
      to: "/$mailboxId/inbox",
      params: { mailboxId },
      search: inboxSearch(inboxMode),
      replace: true,
    });

  const navigateSelectedEmail = (nextEmailId: string) =>
    navigate({
      to: "/$mailboxId/inbox",
      params: { mailboxId },
      search: inboxSearch(inboxMode, nextEmailId),
      replace: true,
    });

  const setInboxMode = (nextMode: InboxMode) => {
    if (nextMode === inboxMode) return;
    navigate({
      to: "/$mailboxId/inbox",
      params: { mailboxId },
      search: inboxSearch(nextMode),
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
      onSnooze={handleSnooze}
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

  return (
    <MailListReaderPage
      showReader={!isMobile && emailData.hasEmails}
      listPane={listPane}
      readerPane={
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
      }
    />
  );
}
