import { Button } from "@/components/ui/button";
import {
 Empty,
 EmptyDescription,
 EmptyHeader,
 EmptyTitle,
} from "@/components/ui/empty";
import { EmailDetailView } from "@/features/email/inbox/pages/email-detail-view";
import {
 useMailActions,
 type MailAction,
} from "@/features/email/mail/hooks/use-mail-actions";
import { useMailViewData } from "@/features/email/mail/hooks/use-mail-view-data";
import { EmailList } from "@/features/email/mail/list/email-list";
import { MailFilterBar } from "@/features/email/mail/list/mail-filter-bar";
import { ViewSyncStatusControl } from "@/features/email/mail/list/view-sync-status";
import type { ThreadIdentifier } from "@/features/email/mail/mutations";
import type { EmailListItem } from "@/features/email/mail/types";
import type { ThreadGroup } from "@/features/email/mail/utils/group-emails-by-thread";
import { MailboxPageHeader } from "@/features/email/shell/mailbox-page";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { FunnelSimpleIcon } from "@phosphor-icons/react";
import type { ReactNode } from "react";

type MailViewData = ReturnType<typeof useMailViewData>;

export function MailListPane({
 title,
 emailData,
 showFilters,
 onShowFiltersChange,
 onOpen,
 onAction,
 selectedEmailId,
 enableKeyboardNavigation = true,
 compact = false,
 headerExtraActions,
 onSnooze,
}: {
 title: string;
 emailData: MailViewData;
 showFilters: boolean;
 onShowFiltersChange: (visible: boolean) => void;
 onOpen: ReturnType<typeof useMailActions>["openEmail"];
 onAction: (
 action: MailAction,
 ids?: string[],
 thread?: ThreadIdentifier,
 ) => void;
 onSnooze?: (group: ThreadGroup, timestamp: number | null) => void;
 selectedEmailId?: string | null;
 enableKeyboardNavigation?: boolean;
 compact?: boolean;
 headerExtraActions?: ReactNode;
}) {
 const isMobile = useIsMobile();
 const showFilterControls = emailData.hasEmails || emailData.hasActiveFilters;
 const filterBarVisible = showFilters || emailData.hasActiveFilters;

 return (
 <div className="flex h-full min-h-0 min-w-0 flex-col">
 <MailboxPageHeader
 title={title}
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
 {!isMobile && (
 <ViewSyncStatusControl
 isBusy={emailData.isLoading || emailData.isRefreshing}
 needsReconnect={emailData.needsReconnect}
 isRateLimited={emailData.isRateLimited}
 onRefresh={() => emailData.refreshView()}
 disabled={emailData.isRefreshingView}
 />
 )}
 {headerExtraActions}
 {showFilterControls && (
 <Button
 variant="ghost"
 size="icon-sm"
 onClick={() => onShowFiltersChange(!filterBarVisible)}
 aria-pressed={filterBarVisible}
 aria-label="Toggle filters"
 className={cn(
 "text-muted-foreground",
 filterBarVisible && "bg-muted",
 )}
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
 onSnooze={onSnooze}
 filterBarOpen={showFilters}
 onFilterBarOpenChange={onShowFiltersChange}
 enableKeyboardNavigation={enableKeyboardNavigation}
 selectedEmailId={selectedEmailId}
 hideFilterControls
 />
 </div>
 );
}

export function MailReaderPane({
 mailboxId,
 view,
 emailId,
 emptyDescription,
 onClose,
 onNavigateToEmail,
}: {
 mailboxId: number;
 view: string;
 emailId: string | null;
 emptyDescription: string;
 onClose: () => void;
 onNavigateToEmail: (nextEmailId: string) => void;
}) {
 if (!emailId) {
 return (
 <div className="flex h-full min-h-0 min-w-0 flex-col bg-background">
 <Empty className="h-full min-h-0 justify-center">
 <EmptyHeader>
 <EmptyTitle>Select an email</EmptyTitle>
 <EmptyDescription>{emptyDescription}</EmptyDescription>
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
 view={view}
 onClose={onClose}
 onNavigateToEmail={onNavigateToEmail}
 embedded
 />
 </div>
 );
}

export type { EmailListItem };
