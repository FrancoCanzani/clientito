import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { PaperclipIcon } from "@phosphor-icons/react";
import type { EmailListItem } from "../types";
import { formatInboxRowDate } from "../utils/format-inbox-row-date";

type EmailRowProps = {
  email: EmailListItem;
  threadCount: number;
  view: string;
  isSelected: boolean;
  isOpen: boolean;
  selectionMode: boolean;
  onOpen: () => void;
  onToggleSelection: (shiftKey: boolean) => void;
};

export function EmailRow({
  email,
  threadCount,
  view,
  isSelected,
  isOpen,
  selectionMode,
  onOpen,
  onToggleSelection,
}: EmailRowProps) {
  const participantLabel =
    view === "sent"
      ? email.toAddr
        ? `To: ${email.toAddr}`
        : "To: (unknown recipient)"
      : email.fromName || email.fromAddr;

  return (
    <div
      data-email-row
      role="button"
      tabIndex={0}
      className={cn(
        "flex w-full group items-center gap-2 rounded-md px-2 py-2 text-left transition-[opacity,background-color] duration-200 ease-out hover:bg-muted/40 cursor-default",
        isOpen && "bg-muted/50",
      )}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
    >
      <Checkbox
        checked={isSelected}
        className={cn("shrink-0 size-3.5 hidden", selectionMode && "block")}
        aria-label={`Select email from ${email.fromName || email.fromAddr}`}
        onClick={(event) => {
          event.stopPropagation();
          onToggleSelection(event.shiftKey);
        }}
        onKeyDown={(event) => {
          event.stopPropagation();
        }}
      />

      <span
        className={cn(
          "size-1.5 shrink-0 rounded-full",
          email.isRead ? "hidden" : "bg-blue-500",
        )}
        aria-hidden
      />

      <div className="min-w-0 flex-1 items-center gap-2 overflow-hidden text-sm sm:flex">
        <span className="shrink-0 truncate font-medium text-foreground sm:max-w-52">
          {participantLabel}
        </span>
        <span className="truncate text-muted-foreground">
          {email.subject ?? "(no subject)"}
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
        {email.aiLabel && (
          <span
            className={cn(
              "capitalize hidden",
              email.aiLabel === "important" && "block italic",
            )}
          >
            {email.aiLabel}
          </span>
        )}
        {email.hasAttachment && (
          <PaperclipIcon className="size-3" aria-hidden />
        )}
        {threadCount > 1 && (
          <span className="font-mono tabular-nums">[{threadCount}]</span>
        )}
        <span className="font-mono">{formatInboxRowDate(email.date)}</span>
      </div>
    </div>
  );
}
