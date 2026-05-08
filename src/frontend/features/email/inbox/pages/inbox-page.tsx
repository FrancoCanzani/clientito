import { Button } from "@/components/ui/button";
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
 selectedEmailId={selectedEmailId}
 enableKeyboardNavigation={!selectedEmailId}
 compact={!isMobile}
 headerExtraActions={screenerButton}
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
 emailId={selectedEmailId}
 emptyDescription="Open a message from the inbox to read it here."
 onClose={clearSelectedEmail}
 onNavigateToEmail={navigateSelectedEmail}
 />
 </ResizablePanel>
 </ResizablePanelGroup>
 </MailboxPage>
 );
}
