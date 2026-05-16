import { cn } from "@/lib/utils";
import { CalendarIcon, PaperclipIcon, StarIcon } from "@phosphor-icons/react";
import { memo } from "react";
import { SenderName } from "@/features/email/mail/sender/sender-name";
import { formatInboxRowDate } from "@/features/email/mail/shared/utils/formatters";
import { HighlightedText } from "@/features/email/mail/search/highlighted-text";
import { EmailRowContextMenu } from "@/features/email/mail/list/email-row-context-menu";
import { type EmailRowProps, useEmailRowModel } from "@/features/email/mail/list/email-row-model";
import { formatRecipientList } from "@/features/email/mail/shared/utils/formatters";

export const SearchEmailRow = memo(function SearchEmailRow({
 isSelected = false,
 ...props
}: EmailRowProps) {
 const { threadCount, subject, snippet, handleOpen, handlePointerEnter, hasMetaIcons, isStarred, email, searchParticipantLabel } =
 useEmailRowModel(props);

 const toLabel = email.toAddr?.trim() || null;
 const highlightTerms = props.highlightTerms ?? [];
 const hasHighlights = highlightTerms.length > 0;
 const shouldShowRecipient =
 email.direction !== "sent" && /\bto:/i.test(props.searchQuery ?? "");
 const recipientHint =
 shouldShowRecipient && toLabel ? formatRecipientList(toLabel) : null;

 return (
 <EmailRowContextMenu
 group={props.group}
 view={props.view}
 onAction={props.onAction}
 onOpenInTab={props.onOpenInTab}
 >
 <div
 role="button"
 tabIndex={-1}
 className="h-full w-full cursor-default text-left text-sm focus:outline-none"
 onClick={handleOpen}
 onPointerEnter={handlePointerEnter}
 >
 <div
 className={cn(
 "flex h-full min-w-0 flex-col justify-center gap-1 overflow-hidden border-b border-border/40 px-4 py-2 transition-colors hover:bg-muted",
 isSelected && "bg-muted",
 )}
 >
 <div className="flex min-w-0 items-center gap-2">
 {email.direction === "sent" ? (
 <span
 className={cn(
 "min-w-0 max-w-[34%] truncate text-sm font-medium text-foreground",
 !email.isRead && "font-semibold",
 )}
 >
 {hasHighlights ? (
 <HighlightedText text={searchParticipantLabel} terms={highlightTerms} />
 ) : (
 searchParticipantLabel
 )}
 </span>
 ) : (
 <SenderName
 email={email.fromAddr}
 name={email.fromName}
 className={cn(
 "min-w-0 max-w-[34%] truncate text-sm font-medium text-foreground hover:underline",
 !email.isRead && "font-semibold",
 )}
 >
 {hasHighlights ? (
 <HighlightedText text={searchParticipantLabel} terms={highlightTerms} />
 ) : (
 searchParticipantLabel
 )}
 </SenderName>
 )}
 <span
 className={cn(
 "min-w-0 flex-1 truncate text-xs text-foreground",
 !email.isRead && "font-medium",
 )}
 >
 {subject}
 </span>
 {!email.isRead && (
 <span className="size-1.5 shrink-0 bg-primary" aria-hidden />
 )}

 <div className="ml-auto flex shrink-0 items-center gap-1.5 text-xs leading-4.5 text-muted-foreground">
 {hasMetaIcons && (
 <div className="flex items-center gap-1">
 {isStarred && (
 <StarIcon
 className="size-3 text-yellow-400"
 weight="fill"
 aria-hidden
 />
 )}
 {email.hasCalendar && (
 <CalendarIcon className="size-3" aria-hidden />
 )}
 {email.hasAttachment && (
 <PaperclipIcon className="size-3" aria-hidden />
 )}
 </div>
 )}
 {threadCount > 1 && (
 <span className="text-[11px] tabular-nums">[{threadCount}]</span>
 )}
 <span className="whitespace-nowrap font-mono text-[10px] tracking-tighter tabular-nums">
 {formatInboxRowDate(email.date)}
 </span>
 </div>
 </div>

 <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
 {recipientHint && (
 <span className="shrink-0 truncate">
 to{" "}
 {hasHighlights ? (
 <HighlightedText text={recipientHint} terms={highlightTerms} />
 ) : (
 recipientHint
 )}
 </span>
 )}
 {recipientHint && snippet && <span aria-hidden>·</span>}
 {snippet && <div className="min-w-0 flex-1 truncate">{snippet}</div>}
 </div>
 </div>
 </div>
 </EmailRowContextMenu>
 );
});
