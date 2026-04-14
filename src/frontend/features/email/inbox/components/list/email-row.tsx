import { ContactAvatar } from "@/components/ui/contact-avatar";
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
import { memo, useRef } from "react";
import type { EmailListItem } from "../../types";
import { formatInboxRowDate } from "../../utils/formatters";
import type { ThreadGroup } from "../../utils/group-emails-by-thread";

export const EmailRow = memo(function EmailRow({
  group,
  view,
  onOpen,
  onAction,
  isFocused = false,
}: {
  group: ThreadGroup;
  view: string;
  onOpen: (email: EmailListItem) => void;
  onAction: (action: EmailInboxAction, ids?: string[]) => void;
  isFocused?: boolean;
}) {
  const queryClient = useQueryClient();
  const prefetchedRef = useRef(false);
  const email = group.representative;
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

    void queryClient.prefetchQuery({
      queryKey: ["email-detail", email.id],
      queryFn: () =>
        fetchEmailDetail(email.id, {
          mailboxId: email.mailboxId ?? undefined,
          view,
        }),
      staleTime: 45_000,
      gcTime: 120_000,
    });
  };

  return (
    <div
      role="button"
      tabIndex={0}
      className={cn(
        "group flex w-full cursor-default items-center gap-3 border-b border-border/50 p-3 h-12 text-left text-sm transition-colors hover:bg-muted/40",
        isFocused && "bg-muted",
      )}
      onMouseEnter={prefetchEmailData}
      onClick={() => onOpen(email)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen(email);
        }
      }}
    >
      <ContactAvatar name={email.fromName} email={email.fromAddr} size="sm" />

      <div className="flex w-36 shrink-0 items-center gap-2 lg:w-48">
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
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-baseline">
          <span
            className={cn(
              "shrink-0 text-sm",
              !email.isRead && "font-medium text-foreground",
            )}
          >
            {email.subject ?? "(no subject)"}
          </span>

          {email.snippet && (
            <span className="ml-1 min-w-0 flex-1 truncate text-sm text-muted-foreground">
              {" — "}
              {email.snippet.replace(/\s+/g, " ").trim()}
            </span>
          )}
        </div>
      </div>

      <div className="relative flex shrink-0 items-center justify-end">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground md:group-hover:invisible">
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
            <span className="shrink-0 tabular-nums">[{threadCount}]</span>
          )}
          <span className="whitespace-nowrap tabular-nums">
            {formatInboxRowDate(email.date)}
          </span>
        </div>

        <div className="absolute inset-y-0 right-0 hidden items-center gap-0.5 md:group-hover:flex">
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
            label="Delete"
            shortcut="#"
            variant="ghost"
            size="icon-sm"
            onClick={(event) => {
              event.stopPropagation();
              onAction("trash", [email.id]);
            }}
          >
            <TrashIcon className="size-3.5" />
          </IconButton>
        </div>
      </div>
    </div>
  );
});
