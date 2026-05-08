import { cn } from "@/lib/utils";
import { CalendarIcon, PaperclipIcon, StarIcon } from "@phosphor-icons/react";
import { memo } from "react";
import { formatInboxRowDate } from "../utils/formatters";
import { type EmailRowProps, useEmailRowModel } from "./email-row-model";

export const TaskEmailRow = memo(function TaskEmailRow({
 isFocused = false,
 isSelected = false,
 ...props
}: EmailRowProps) {
 const {
 threadCount,
 participantLabel,
 subject,
 snippet,
 handleMouseEnter,
 handleOpen,
 handleKeyDown,
 hasMetaIcons,
 isStarred,
 email,
 } = useEmailRowModel(props);

 return (
 <div
 role="button"
 tabIndex={0}
 className={cn(
 "mx-3 my-1 flex h-12 cursor-default items-center gap-3 border border-border/40 bg-card/50 px-3 text-left transition-colors hover:bg-muted/70 md:mx-6",
 isFocused && "bg-muted",
 isSelected && "bg-muted ring-1 ring-border/70",
 )}
 onMouseEnter={handleMouseEnter}
 onFocus={handleMouseEnter}
 onClick={handleOpen}
 onKeyDown={handleKeyDown}
 >
 <span
 className={cn(
 "size-2 shrink-0 bg-muted-foreground/30",
 !email.isRead && "bg-blue-500",
 )}
 aria-hidden
 />
 <div className="min-w-0 flex-1">
 <div className="flex min-w-0 items-center gap-2">
 {!email.isRead && <span className="sr-only">Unread.</span>}
 <span
 className={cn(
 "truncate text-sm font-medium text-foreground",
 !email.isRead && "font-semibold",
 )}
 >
 {subject}
 </span>
 {threadCount > 1 && (
 <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
 [{threadCount}]
 </span>
 )}
 </div>
 <div className="mt-0.5 truncate text-xs text-muted-foreground">
 {participantLabel}
 {snippet && ` · ${snippet}`}
 </div>
 </div>
 {hasMetaIcons && (
 <div className="hidden shrink-0 items-center gap-1.5 text-muted-foreground sm:flex">
 {isStarred && (
 <StarIcon className="size-3.5 text-yellow-400" weight="fill" aria-hidden />
 )}
 {email.hasCalendar && <CalendarIcon className="size-3.5" aria-hidden />}
 {email.hasAttachment && (
 <PaperclipIcon className="size-3.5" aria-hidden />
 )}
 </div>
 )}
 <span className="shrink-0 whitespace-nowrap text-xs tabular-nums text-muted-foreground">
 {formatInboxRowDate(email.date)}
 </span>
 </div>
 );
});
