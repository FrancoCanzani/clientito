import { IconButton } from "@/components/ui/icon-button";
import { fetchEmailDetailAI } from "@/features/inbox/queries";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import {
  ArchiveIcon,
  EnvelopeSimpleIcon,
  EnvelopeSimpleOpenIcon,
  PaperclipIcon,
  StarIcon,
  TrashIcon,
} from "@phosphor-icons/react";
import type { EmailInboxAction } from "@/features/inbox/hooks/use-email-inbox-actions";
import type { EmailView } from "@/features/inbox/utils/inbox-filters";
import type { EmailListItem } from "../types";
import { formatInboxRowDate } from "../utils/formatters";
import type { ThreadGroup } from "../utils/group-emails-by-thread";

export function EmailRow({
  group,
  isOpen,
  view,
  onOpen,
  onAction,
}: {
  group: ThreadGroup;
  isOpen: boolean;
  view: EmailView;
  onOpen: (email: EmailListItem) => void;
  onAction: (action: EmailInboxAction, ids?: string[]) => void;
}) {
  const queryClient = useQueryClient();
  const email: EmailListItem = group.representative;
  const isStarred = email.labelIds.includes("STARRED");
  const isInInbox = email.labelIds.includes("INBOX");
  const archiveAction = isInInbox ? "archive" : "move-to-inbox";
  const archiveLabel = isInInbox ? "Archive" : "Move to inbox";
  const threadCount = group.threadCount;
  const participantLabel =
    view === "sent"
      ? email.toAddr
        ? `To: ${email.toAddr}`
        : "To: (unknown recipient)"
      : email.fromName || email.fromAddr;

  const prefetchAi = () => {
    if (email.isRead) return;
    void queryClient.prefetchQuery({
      queryKey: ["email-ai-detail", email.id],
      queryFn: () => fetchEmailDetailAI(email.id),
    });
  };

  return (
    <div
      role="button"
      tabIndex={0}
      className={cn(
        "flex w-full group items-center gap-2 rounded-md px-2 py-2 text-left transition-[opacity,background-color] duration-200 ease-out hover:bg-muted/40 cursor-default",
        isOpen && "bg-muted/50",
      )}
      onMouseEnter={prefetchAi}
      onFocus={prefetchAi}
      onClick={() => onOpen(email)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen(email);
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

      <div className="min-w-0 flex-1 items-center gap-2 overflow-hidden flex">
        <span className="text-sm shrink-0 truncate tracking-[-0.6px] text-foreground font-medium">
          {participantLabel}
        </span>
        <span className="text-foreground/50 text-sm truncate tracking-[-0.2px]">
          {email.subject ?? "(no subject)"}
        </span>
      </div>

      <div className="shrink-0">
        <div className="relative flex md:min-w-24 justify-end text-xs text-muted-foreground">
          <div className="flex items-center gap-2 md:group-hover:invisible">
            {isStarred && (
              <StarIcon
                className="size-3.5 text-yellow-400"
                weight="fill"
                aria-hidden
              />
            )}
            {email.hasAttachment && (
              <PaperclipIcon className="size-3.5" aria-hidden />
            )}
            {threadCount > 1 && (
              <span className="tabular-nums">[{threadCount}]</span>
            )}
            <span className="tabular-nums">
              {formatInboxRowDate(email.date)}
            </span>
          </div>

          <div className="absolute inset-y-0 right-0 hidden items-center justify-end md:group-hover:flex">
            <IconButton
              label={archiveLabel}
              variant="ghost"
              size="icon-sm"
              onClick={(event) => {
                event.stopPropagation();
                onAction(archiveAction, [email.id]);
              }}
            >
              <ArchiveIcon className="size-3.5" />
            </IconButton>
            <IconButton
              label={email.isRead ? "Mark as unread" : "Mark as read"}
              variant="ghost"
              size="icon-sm"
              onClick={(event) => {
                event.stopPropagation();
                onAction(email.isRead ? "mark-unread" : "mark-read", [email.id]);
              }}
            >
              {email.isRead ? (
                <EnvelopeSimpleIcon className="size-3.5" />
              ) : (
                <EnvelopeSimpleOpenIcon className="size-3.5" />
              )}
            </IconButton>
            <IconButton
              label={isStarred ? "Unstar" : "Star"}
              variant="ghost"
              size="icon-sm"
              onClick={(event) => {
                event.stopPropagation();
                onAction(isStarred ? "unstar" : "star", [email.id]);
              }}
            >
              <StarIcon
                className={cn("size-3.5", isStarred && "text-yellow-400")}
                weight={isStarred ? "fill" : "regular"}
              />
            </IconButton>
            <IconButton
              label="Delete"
              variant="ghost"
              size="icon-sm"
              onClick={(event) => {
                event.stopPropagation();
                onAction("trash", [email.id]);
              }}
            >
              <TrashIcon className="size-3.5" fill="red" />
            </IconButton>
          </div>
        </div>
      </div>
    </div>
  );
}
