import { IconButton } from "@/components/ui/icon-button";
import type { EmailInboxAction } from "@/features/email/inbox/hooks/use-email-inbox-actions";
import { fetchEmailDetail } from "@/features/email/inbox/queries";
import { cn } from "@/lib/utils";
import {
  CheckIcon,
  EnvelopeSimpleIcon,
  EnvelopeSimpleOpenIcon,
  PaperclipIcon,
  StarIcon,
  TrashIcon,
} from "@phosphor-icons/react";
import { useQueryClient } from "@tanstack/react-query";
import { memo, useRef, useState } from "react";
import type { EmailListItem } from "../../types";
import { formatInboxRowDate } from "../../utils/formatters";
import type { ThreadGroup } from "../../utils/group-emails-by-thread";

export const EmailRow = memo(function EmailRow({
  group,
  view,
  onOpen,
  onAction,
  isFocused = false,
  isSelected = false,
}: {
  group: ThreadGroup;
  view: string;
  onOpen: (email: EmailListItem) => void;
  onAction: (action: EmailInboxAction, ids?: string[]) => void;
  isFocused?: boolean;
  isSelected?: boolean;
}) {
  const queryClient = useQueryClient();
  const prefetchedRef = useRef(false);
  const [isHovered, setIsHovered] = useState(false);
  const email: EmailListItem = group.representative;
  const isStarred = email.labelIds.includes("STARRED");
  const isInInbox = email.labelIds.includes("INBOX");
  const archiveAction = isInInbox ? "archive" : "move-to-inbox";
  const archiveLabel = isInInbox ? "Done" : "Move to inbox";
  const threadCount = group.threadCount;
  const participantLabel =
    view === "sent"
      ? email.toAddr
        ? `To: ${email.toAddr}`
        : "To: (unknown recipient)"
      : email.fromName || email.fromAddr;

  const prefetchEmailData = () => {
    if (prefetchedRef.current) return;
    prefetchedRef.current = true;

    const detailKey = ["email-detail", email.id];
    const detailState = queryClient.getQueryState(detailKey);
    if (detailState?.status !== "success") {
      void queryClient.prefetchQuery({
        queryKey: detailKey,
        queryFn: () =>
          fetchEmailDetail(email.id, {
            mailboxId: email.mailboxId ?? undefined,
            view,
          }),
        staleTime: 45_000,
        gcTime: 120_000,
      });
    }
  };

  const isActive = isFocused || isSelected;

  return (
    <div
      role="button"
      tabIndex={0}
      className={cn(
        "group flex h-10 w-full border-dashed border-b cursor-default items-center gap-2 px-2 text-left text-sm transition-colors hover:bg-muted/40",
        isActive && "bg-muted",
      )}
      onMouseEnter={() => {
        prefetchEmailData();
        setIsHovered(true);
      }}
      onMouseLeave={() => setIsHovered(false)}
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
          email.isRead ? "invisible" : "bg-blue-500",
        )}
        aria-hidden
      />

      <span
        className={cn(
          "min-w-0 max-w-[30%] shrink-0 truncate text-sm",
          email.isRead ? "text-foreground/70" : "font-medium text-foreground",
        )}
      >
        {participantLabel}
      </span>

      {threadCount > 1 && (
        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
          {threadCount}
        </span>
      )}

      <span className="mx-0.5 shrink-0 text-foreground/20">-</span>

      <div className="min-w-0 flex-1 truncate">
        <span
          className={cn(
            "text-sm",
            email.isRead ? "text-foreground/50" : "text-foreground/70",
          )}
        >
          {email.subject ?? "(no subject)"}
        </span>
        {email.snippet && (
          <span className="text-sm text-foreground/30">
            {" "}
            {email.snippet}
          </span>
        )}
      </div>

      <div className="shrink-0">
        <div className="relative flex items-center justify-end gap-1.5 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5 md:group-hover:invisible">
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
            <span className="tabular-nums whitespace-nowrap">
              {formatInboxRowDate(email.date)}
            </span>
          </div>

          {isHovered && (
            <div className="absolute inset-y-0 right-0 hidden items-center justify-end md:flex">
              <IconButton
                label={archiveLabel}
                shortcut="E"
                variant="ghost"
                size="icon-sm"
                onClick={(event) => {
                  event.stopPropagation();
                  onAction(archiveAction, [email.id]);
                }}
              >
                <CheckIcon className="size-3.5" />
              </IconButton>
              <IconButton
                label={email.isRead ? "Mark as unread" : "Mark as read"}
                shortcut="U"
                variant="ghost"
                size="icon-sm"
                onClick={(event) => {
                  event.stopPropagation();
                  onAction(email.isRead ? "mark-unread" : "mark-read", [
                    email.id,
                  ]);
                }}
              >
                {email.isRead ? (
                  <EnvelopeSimpleIcon className="size-3.5" />
                ) : (
                  <EnvelopeSimpleOpenIcon className="size-3.5" />
                )}
              </IconButton>
              <IconButton
                label="Delete"
                shortcut="#"
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
          )}
        </div>
      </div>
    </div>
  );
});
