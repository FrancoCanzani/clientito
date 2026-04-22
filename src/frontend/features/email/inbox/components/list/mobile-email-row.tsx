import { cn } from "@/lib/utils";
import { CalendarIcon, PaperclipIcon, StarIcon } from "@phosphor-icons/react";
import { memo } from "react";
import { formatInboxRowDate } from "../../utils/formatters";
import { type EmailRowProps, useEmailRowModel } from "./email-row-model";

export const MobileEmailRow = memo(function MobileEmailRow({
  isFocused = false,
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
        "flex h-14 w-full cursor-default items-center border-b border-border/40 px-4 text-left text-sm transition-colors hover:bg-muted",
        isFocused && "bg-muted",
      )}
      onMouseEnter={handleMouseEnter}
      onFocus={handleMouseEnter}
      onClick={handleOpen}
      onKeyDown={handleKeyDown}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "truncate text-sm",
              !email.isRead && "font-semibold text-foreground",
            )}
          >
            {participantLabel}
          </span>
          {!email.isRead && (
            <span
              className="size-1.5 shrink-0 rounded-full bg-blue-500"
              aria-hidden
            />
          )}
          {threadCount > 1 && (
            <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
              [{threadCount}]
            </span>
          )}
        </div>

        <div className="mt-0.5 flex min-w-0 items-center gap-1.5 overflow-hidden">
          <span
            className={cn(
              "max-w-[60%] shrink-0 truncate",
              !email.isRead && "font-medium text-foreground",
            )}
          >
            {subject}
          </span>
          {snippet && (
            <span className="min-w-0 truncate text-muted-foreground">
              {snippet}
            </span>
          )}
        </div>
      </div>

      <div className="ml-2 flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
        {hasMetaIcons && (
          <div className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
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
        <span className="whitespace-nowrap tabular-nums">
          {formatInboxRowDate(email.date)}
        </span>
      </div>
    </div>
  );
});
