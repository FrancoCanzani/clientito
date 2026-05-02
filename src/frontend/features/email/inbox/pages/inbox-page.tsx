import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { useGatekeeperPending } from "@/features/email/gatekeeper/queries";
import { useInboxData } from "@/features/email/inbox/hooks/use-inbox-data";
import { EmailDetailView } from "@/features/email/inbox/pages/email-detail-view";
import {
  useMailActions,
  type MailAction,
} from "@/features/email/mail/hooks/use-mail-actions";
import { EmailList } from "@/features/email/mail/list/email-list";
import { MailFilterBar } from "@/features/email/mail/list/mail-filter-bar";
import type { ThreadIdentifier } from "@/features/email/mail/mutations";
import type { EmailListItem } from "@/features/email/mail/types";
import {
  MailboxPage,
  MailboxPageHeader,
} from "@/features/email/shell/mailbox-page";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { FunnelSimpleIcon } from "@phosphor-icons/react";
import { Link, getRouteApi } from "@tanstack/react-router";
import { useState } from "react";

const route = getRouteApi("/_dashboard/$mailboxId/inbox/");

export default function InboxPage() {
  const { mailboxId } = route.useParams();
  const search = route.useSearch();
  const navigate = route.useNavigate();
  const isMobile = useIsMobile();
  const [showFilters, setShowFilters] = useState(false);
  const emailData = useInboxData({ mailboxId });
  const { openEmail, executeEmailAction } = useMailActions({
    view: "inbox",
    mailboxId,
    presentation: isMobile ? "route" : "panel",
  });

  const gatekeeperPendingQuery = useGatekeeperPending(mailboxId, true);
  const pendingSendersCount = gatekeeperPendingQuery.data?.pendingCount ?? 0;
  const selectedEmailId = isMobile ? null : (search.emailId ?? null);

  const clearSelectedEmail = () =>
    navigate({
      to: "/$mailboxId/inbox",
      params: { mailboxId },
      search: {},
      replace: true,
    });

  const navigateSelectedEmail = (nextEmailId: string) =>
    navigate({
      to: "/$mailboxId/inbox",
      params: { mailboxId },
      search: { emailId: nextEmailId },
      replace: true,
    });

  if (isMobile) {
    return (
      <MailboxPage>
        <InboxListPane
          mailboxId={mailboxId}
          emailData={emailData}
          pendingSendersCount={pendingSendersCount}
          showFilters={showFilters}
          onShowFiltersChange={setShowFilters}
          onOpen={openEmail}
          onAction={executeEmailAction}
        />
      </MailboxPage>
    );
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
          <InboxListPane
            mailboxId={mailboxId}
            emailData={emailData}
            pendingSendersCount={pendingSendersCount}
            showFilters={showFilters}
            onShowFiltersChange={setShowFilters}
            onOpen={openEmail}
            onAction={executeEmailAction}
            selectedEmailId={selectedEmailId}
            enableKeyboardNavigation={!selectedEmailId}
            compact
          />
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel minSize="360px" defaultSize="50%" className="min-w-0">
          <InboxReaderPane
            mailboxId={mailboxId}
            emailId={selectedEmailId}
            onClose={clearSelectedEmail}
            onNavigateToEmail={navigateSelectedEmail}
          />
        </ResizablePanel>
      </ResizablePanelGroup>
    </MailboxPage>
  );
}

function InboxListPane({
  mailboxId,
  emailData,
  pendingSendersCount,
  showFilters,
  onShowFiltersChange,
  onOpen,
  onAction,
  selectedEmailId,
  enableKeyboardNavigation = true,
  compact = false,
}: {
  mailboxId: number;
  emailData: ReturnType<typeof useInboxData>;
  pendingSendersCount: number;
  showFilters: boolean;
  onShowFiltersChange: (visible: boolean) => void;
  onOpen: (email: EmailListItem) => void;
  onAction: (
    action: MailAction,
    ids?: string[],
    thread?: ThreadIdentifier,
  ) => void;
  selectedEmailId?: string | null;
  enableKeyboardNavigation?: boolean;
  compact?: boolean;
}) {
  const showScreener = pendingSendersCount > 0;
  const showFilterControls = emailData.hasEmails || emailData.hasActiveFilters;
  const filterBarVisible = showFilters || emailData.hasActiveFilters;

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col">
      <MailboxPageHeader
        title="Inbox"
        actions={
          <>
            {showFilterControls && filterBarVisible && !compact && (
              <MailFilterBar
                filters={emailData.filters}
                onChange={emailData.setFilters}
                view={emailData.view}
                className="hidden md:flex"
              />
            )}
            {showScreener && (
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
            )}
            {showFilterControls && (
              <Button
                variant="ghost"
                onClick={() => onShowFiltersChange(!filterBarVisible)}
                aria-pressed={filterBarVisible}
                className={cn("gap-1.5", filterBarVisible && "bg-muted")}
              >
                <FunnelSimpleIcon className="size-3.5" />
              </Button>
            )}
          </>
        }
      />
      {showFilterControls && filterBarVisible && (
        <MailFilterBar
          filters={emailData.filters}
          onChange={emailData.setFilters}
          view={emailData.view}
          className={cn("flex px-3 pb-1.5", !compact && "md:hidden")}
        />
      )}
      <EmailList
        emailData={emailData}
        onOpen={onOpen}
        onAction={onAction}
        filterBarOpen={showFilters}
        onFilterBarOpenChange={onShowFiltersChange}
        enableKeyboardNavigation={enableKeyboardNavigation}
        selectedEmailId={selectedEmailId}
        hideFilterControls
      />
    </div>
  );
}

function InboxReaderPane({
  mailboxId,
  emailId,
  onClose,
  onNavigateToEmail,
}: {
  mailboxId: number;
  emailId: string | null;
  onClose: () => void;
  onNavigateToEmail: (nextEmailId: string) => void;
}) {
  if (!emailId) {
    return (
      <div className="flex h-full min-h-0 min-w-0 flex-col border-l bg-background">
        <Empty className="h-full min-h-0 justify-center">
          <EmptyHeader>
            <EmptyTitle>Select an email</EmptyTitle>
            <EmptyDescription>
              Open a message from the inbox to read it here.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col bg-background">
      <EmailDetailView
        mailboxId={mailboxId}
        emailId={emailId}
        view="inbox"
        onClose={onClose}
        onNavigateToEmail={onNavigateToEmail}
        embedded
      />
    </div>
  );
}
