import { Button } from "@/components/ui/button";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { IconButton } from "@/components/ui/icon-button";
import { LabelChip } from "@/features/email/labels/components/label-chip";
import type { RowAction } from "@/features/email/inbox/utils/row-actions";
import { cn } from "@/lib/utils";
import {
  ArrowRightIcon,
  CalendarIcon,
  PaperclipIcon,
  StarIcon,
} from "@phosphor-icons/react";
import { memo } from "react";
import { formatInboxRowDate } from "../../utils/formatters";
import { type EmailRowProps, useEmailRowModel } from "./email-row-model";

export const DesktopEmailRow = memo(function DesktopEmailRow({
  isFocused = false,
  ...props
}: EmailRowProps) {
  const {
    threadCount,
    rowActions,
    participantLabel,
    subject,
    snippet,
    aiCategoryLabel,
    handleMouseEnter,
    handleOpen,
    handleKeyDown,
    runAction,
    visibleChips,
    hiddenChipCount,
    hasMetaIcons,
    isStarred,
    email,
    actionsMounted,
  } = useEmailRowModel(props);

  return (
    <div
      role="button"
      tabIndex={0}
      className={cn(
        "group flex h-10 w-full cursor-default items-center gap-3 rounded-md px-6 text-left text-sm transition-colors hover:bg-muted",
        isFocused && "bg-muted",
      )}
      onMouseEnter={handleMouseEnter}
      onFocus={handleMouseEnter}
      onClick={handleOpen}
      onKeyDown={handleKeyDown}
    >
      <div className="flex w-24 shrink-0 items-center gap-2 sm:w-28 lg:w-44 xl:w-52">
        <span
          className={cn(
            "truncate text-sm",
            !email.isRead && "font-semibold text-foreground",
          )}
        >
          {participantLabel}
        </span>
        {!email.isRead && (
          <span className="size-1.5 shrink-0 rounded-full bg-blue-500" aria-hidden />
        )}
        {threadCount > 1 && (
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
            [{threadCount}]
          </span>
        )}
      </div>

      <div className="min-w-0 flex flex-1 items-center gap-3 overflow-hidden">
        <span
          className={cn(
            "shrink-0 max-w-full truncate lg:max-w-[calc(100%-6rem)]",
            !email.isRead && "font-medium text-foreground",
          )}
        >
          {subject}
        </span>
        {snippet && (
          <span className="min-w-0 shrink truncate text-muted-foreground">{snippet}</span>
        )}
      </div>

      <div className="relative ml-auto flex shrink-0 items-center justify-end gap-2">
        {(aiCategoryLabel || visibleChips.length > 0) && (
          <div className="flex shrink-0 items-center gap-1">
            {aiCategoryLabel && <LabelChip label={aiCategoryLabel} />}
            {visibleChips.map((label) => (
              <LabelChip key={label.gmailId} label={label} />
            ))}
            {hiddenChipCount > 0 && (
              <span className="text-[11px] leading-none text-muted-foreground">
                +{hiddenChipCount}
              </span>
            )}
          </div>
        )}

        {hasMetaIcons && (
          <div className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
            {isStarred && (
              <StarIcon className="size-3.5 text-yellow-400" weight="fill" aria-hidden />
            )}
            {email.hasCalendar && <CalendarIcon className="size-3.5" aria-hidden />}
            {email.hasAttachment && <PaperclipIcon className="size-3.5" aria-hidden />}
          </div>
        )}

        <span className="whitespace-nowrap text-xs tabular-nums text-muted-foreground group-hover:invisible group-focus-within:invisible">
          {formatInboxRowDate(email.date)}
        </span>

        {actionsMounted && (
          <EmailRowActions
            rowActions={rowActions}
            onRunAction={runAction}
            onOpen={handleOpen}
            summary={email.aiSummary}
          />
        )}
      </div>
    </div>
  );
});

function EmailRowActions({
  rowActions,
  onRunAction,
  onOpen,
  summary,
}: {
  rowActions: RowAction[];
  onRunAction: (rowAction: RowAction) => void;
  onOpen: () => void;
  summary: string | null;
}) {
  const summaryText = summary?.trim() || null;

  return (
    <div
      className="absolute right-0 top-1/2 flex h-8 -translate-y-1/2 items-center gap-0.5 rounded-md bg-muted px-1 shadow ring-1 ring-border/40 opacity-0 pointer-events-none transition-opacity group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto"
      onClick={(event) => event.stopPropagation()}
    >
      {rowActions.map((rowAction) => {
        const Icon = rowAction.icon;

        return (
          <IconButton
            key={rowAction.key}
            label={rowAction.label}
            shortcut={rowAction.shortcut}
            variant="ghost"
            size="icon-sm"
            onClick={(event) => {
              event.stopPropagation();
              onRunAction(rowAction);
            }}
          >
            <Icon className="size-3.5" weight={rowAction.iconWeight} />
          </IconButton>
        );
      })}
      {summaryText && (
        <HoverCard openDelay={120}>
          <HoverCardTrigger asChild>
            <Button
              type="button"
              aria-label="Summary"
              variant="ghost"
              size="icon-sm"
              className="text-[10px] font-semibold"
              onClick={(event) => {
                event.stopPropagation();
              }}
            >
              S
            </Button>
          </HoverCardTrigger>
          <HoverCardContent
            align="end"
            className="w-80 whitespace-pre-wrap text-xs leading-relaxed"
          >
            {summaryText}
          </HoverCardContent>
        </HoverCard>
      )}
      <IconButton
        label="Open"
        shortcut="Enter"
        variant="ghost"
        size="icon-sm"
        onClick={(event) => {
          event.stopPropagation();
          onOpen();
        }}
      >
        <ArrowRightIcon className="size-3.5" />
      </IconButton>
    </div>
  );
}
