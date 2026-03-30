import { cn } from "@/lib/utils";
import {
  ArchiveIcon,
  EnvelopeSimpleIcon,
  EnvelopeSimpleOpenIcon,
  PaperclipIcon,
  TrashIcon,
} from "@phosphor-icons/react";
import type { EmailListItem } from "../types";
import { formatInboxRowDate } from "../utils/formatters";

function formatAiLabel(label: EmailListItem["aiLabel"]) {
  if (label === "later") return "important";
  if (label === "action_needed") return "requires action";
  return label?.replace(/_/g, " ") ?? null;
}

type EmailRowProps = {
  email: EmailListItem;
  threadCount: number;
  view: string;
  isOpen: boolean;
  onOpen: () => void;
  onArchive: () => void;
  onTrash: () => void;
  onToggleRead: () => void;
};

export function EmailRow({
  email,
  threadCount,
  view,
  isOpen,
  onOpen,
  onArchive,
  onTrash,
  onToggleRead,
}: EmailRowProps) {
  const participantLabel =
    view === "sent"
      ? email.toAddr
        ? `To: ${email.toAddr}`
        : "To: (unknown recipient)"
      : email.fromName || email.fromAddr;
  const visibleAiLabel = formatAiLabel(email.aiLabel);

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
      <span
        className={cn(
          "size-1.5 shrink-0 rounded-full",
          email.isRead ? "hidden" : "bg-blue-500",
        )}
        aria-hidden
      />

      <div className="min-w-0 flex-1 items-center gap-2 overflow-hidden text-sm flex">
        <span className="shrink-0 truncate font-medium max-w-52">
          {participantLabel}
        </span>
        <span className="truncate text-muted-foreground">
          {email.subject ?? "(no subject)"}
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
        {visibleAiLabel && (
          <span
            className={cn(
              "capitalize hidden",
              (visibleAiLabel === "important" ||
                visibleAiLabel === "requires action") &&
                "block italic",
            )}
          >
            {visibleAiLabel}
          </span>
        )}
        {email.hasAttachment && (
          <PaperclipIcon className="size-3" aria-hidden />
        )}
        {threadCount > 1 && (
          <span className="font-mono tabular-nums">[{threadCount}]</span>
        )}
        <div className="grid [grid-template-areas:'stack'] items-center">
          <span className="[grid-area:stack] font-mono group-hover:invisible">
            {formatInboxRowDate(email.date)}
          </span>
          <div className="[grid-area:stack] invisible group-hover:visible flex items-center justify-end gap-0.5">
            <button
              type="button"
              className="rounded-sm p-0.5 text-muted-foreground hover:text-foreground"
              onClick={(e) => { e.stopPropagation(); onArchive(); }}
              aria-label="Archive"
            >
              <ArchiveIcon className="size-4" />
            </button>
            <button
              type="button"
              className="rounded-sm p-0.5 text-muted-foreground hover:text-foreground"
              onClick={(e) => { e.stopPropagation(); onToggleRead(); }}
              aria-label={email.isRead ? "Mark as unread" : "Mark as read"}
            >
              {email.isRead ? (
                <EnvelopeSimpleIcon className="size-4" />
              ) : (
                <EnvelopeSimpleOpenIcon className="size-4" />
              )}
            </button>
            <button
              type="button"
              className="rounded-sm p-0.5 text-muted-foreground hover:text-foreground"
              onClick={(e) => { e.stopPropagation(); onTrash(); }}
              aria-label="Delete"
            >
              <TrashIcon className="size-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
