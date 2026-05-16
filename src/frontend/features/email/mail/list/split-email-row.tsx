import { EmailRowContextMenu } from "@/features/email/mail/list/email-row-context-menu";
import {
  type EmailRowProps,
  useEmailRowModel,
} from "@/features/email/mail/list/email-row-model";
import { SenderName } from "@/features/email/mail/sender/sender-name";
import { formatInboxRowDate } from "@/features/email/mail/shared/utils/formatters";
import { cn } from "@/lib/utils";
import { CalendarIcon, PaperclipIcon, StarIcon } from "@phosphor-icons/react";
import { memo } from "react";

export const SplitEmailRow = memo(function SplitEmailRow({
  isFocused: _isFocused = false,
  isSelected = false,
  ...props
}: EmailRowProps) {
  const {
    threadCount,
    participantLabel,
    subject,
    snippet,
    handleOpen,
    handlePointerEnter,
    hasMetaIcons,
    isStarred,
    email,
  } = useEmailRowModel(props);

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
        className="h-full w-full cursor-default text-left text-sm focus:outline-none focus:ring-0"
        onClick={handleOpen}
        onPointerEnter={handlePointerEnter}
      >
        <div
          className={cn(
            "flex h-full min-w-0 flex-col justify-center gap-0.5 overflow-hidden border-b border-border/40 px-4 py-1.5 transition-colors hover:bg-muted",
            isSelected && "bg-muted",
          )}
        >
          <div className="flex min-w-0 items-center gap-1.5">
            {!email.isRead && <span className="sr-only">Unread.</span>}
            {props.view === "sent" ? (
              <span
                className={cn(
                  "min-w-0 truncate text-sm font-medium text-foreground",
                  !email.isRead && "font-semibold",
                )}
              >
                {participantLabel}
              </span>
            ) : (
              <SenderName
                email={email.fromAddr}
                name={email.fromName}
                className={cn(
                  "min-w-0 truncate text-sm font-medium text-foreground hover:underline",
                  !email.isRead && "font-semibold",
                )}
              >
                {participantLabel}
              </SenderName>
            )}
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
                <span className="text-[11px] tabular-nums">
                  [{threadCount}]
                </span>
              )}
              <span className="whitespace-nowrap font-mono text-xs tracking-tighter tabular-nums">
                {formatInboxRowDate(email.date)}
              </span>
            </div>
          </div>

          <div
            className={cn(
              "truncate text-xs leading-4.5",
              !email.isRead && "font-medium text-foreground",
            )}
          >
            {subject}
          </div>

          {snippet && (
            <div className="line-clamp-2 max-h-7 min-w-0 overflow-hidden text-pretty text-xxs text-muted-foreground">
              {snippet}
            </div>
          )}
        </div>
      </div>
    </EmailRowContextMenu>
  );
});
