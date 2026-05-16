import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Kbd } from "@/components/ui/kbd";
import { useMailCompose } from "@/features/email/mail/compose/compose-context";
import type { MailAction } from "@/features/email/mail/shared/hooks/use-mail-actions";
import type { ThreadIdentifier } from "@/features/email/mail/shared/mutations";
import type { ThreadGroup } from "@/features/email/mail/thread/group-emails-by-thread";
import { buildReplyInitial } from "@/features/email/mail/thread/reply-compose";
import { shortcutKey } from "@/lib/shortcuts";
import { getRouteApi, useNavigate } from "@tanstack/react-router";
import {
  ArchiveIcon,
  ArrowBendUpLeftIcon,
  ArrowBendUpRightIcon,
  ArrowSquareOutIcon,
  CopyIcon,
  EnvelopeSimpleIcon,
  EnvelopeSimpleOpenIcon,
  MagnifyingGlassIcon,
  StarIcon,
  TrashIcon,
  TrayIcon,
  WarningIcon,
} from "@phosphor-icons/react";
import { type ReactNode } from "react";
import { toast } from "sonner";

const mailboxRoute = getRouteApi("/_dashboard/$mailboxId");

export function EmailRowContextMenu({
  group,
  view,
  onAction,
  onOpenInTab,
  children,
}: {
  group: ThreadGroup;
  view: string;
  onAction: (
    action: MailAction,
    ids?: string[],
    thread?: ThreadIdentifier,
  ) => void;
  onOpenInTab?: (email: ThreadGroup["representative"]) => void;
  children: ReactNode;
}) {
  const { mailboxId } = mailboxRoute.useParams();
  const navigate = useNavigate();
  const { openCompose } = useMailCompose();
  const email = group.representative;
  const isStarred = email.labelIds.includes("STARRED");
  const isInTrash = view === "trash";
  const isInSpam = view === "spam";
  const isInInbox = email.labelIds.includes("INBOX");

  const ids = group.emails.map((e) => e.id);
  const newestReceived =
    [...group.emails]
      .filter((e) => e.direction !== "sent")
      .sort((a, b) => b.date - a.date)[0] ?? email;

  const run = (
    action: MailAction,
    targetIds: string[] = ids,
    thread?: ThreadIdentifier,
  ) => onAction(action, targetIds, thread);

  const threadIdentifier: ThreadIdentifier | undefined =
    group.threadId && email.mailboxId
      ? {
          threadId: group.threadId,
          mailboxId: email.mailboxId,
          labelIds: email.labelIds,
        }
      : undefined;

  const handleReply = () => openCompose(buildReplyInitial(email));

  const handleForward = () => {
    const subject = email.subject
      ? email.subject.startsWith("Fwd:")
        ? email.subject
        : `Fwd: ${email.subject}`
      : "Fwd:";
    openCompose({ mailboxId: email.mailboxId, subject });
  };

  const handleFindFromSender = () => {
    void navigate({
      to: "/$mailboxId/inbox/search",
      params: { mailboxId },
      search: { q: `from:${email.fromAddr}` },
    });
  };

  const handleCopyEmail = async () => {
    try {
      await navigator.clipboard.writeText(email.fromAddr);
      toast.success("Email address copied");
    } catch {
      toast.error("Couldn't copy email address");
    }
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent>
        {onOpenInTab && (
          <>
            <ContextMenuItem onSelect={() => onOpenInTab(email)}>
              <ArrowSquareOutIcon />
              <span className="flex-1">Open in new tab</span>
              <Kbd>{shortcutKey("inbox:open-in-tab")}</Kbd>
            </ContextMenuItem>
            <ContextMenuSeparator />
          </>
        )}
        <ContextMenuItem onSelect={handleReply}>
          <ArrowBendUpLeftIcon />
          <span className="flex-1">Reply</span>
          <Kbd>{shortcutKey("action:reply")}</Kbd>
        </ContextMenuItem>

        <ContextMenuItem onSelect={handleForward}>
          <ArrowBendUpRightIcon />
          <span className="flex-1">Forward</span>
          <Kbd>{shortcutKey("action:forward")}</Kbd>
        </ContextMenuItem>

        <ContextMenuSeparator />

        <ContextMenuItem
          onSelect={() =>
            run(email.isRead ? "mark-unread" : "mark-read", [newestReceived.id])
          }
        >
          {email.isRead ? <EnvelopeSimpleIcon /> : <EnvelopeSimpleOpenIcon />}
          <span className="flex-1">
            {email.isRead ? "Mark as unread" : "Mark as read"}
          </span>
          <Kbd>{shortcutKey("action:toggle-read")}</Kbd>
        </ContextMenuItem>

        <ContextMenuItem
          onSelect={() => run(isStarred ? "unstar" : "star", [email.id])}
        >
          <StarIcon weight={isStarred ? "fill" : "regular"} />
          <span className="flex-1">{isStarred ? "Unstar" : "Star"}</span>
          <Kbd>{shortcutKey("action:star")}</Kbd>
        </ContextMenuItem>

        <ContextMenuSeparator />

        {!isInTrash && !isInSpam && isInInbox && (
          <ContextMenuItem
            onSelect={() => run("archive", ids, threadIdentifier)}
          >
            <ArchiveIcon />
            <span className="flex-1">Mark as done</span>
            <Kbd>{shortcutKey("action:archive")}</Kbd>
          </ContextMenuItem>
        )}

        {(isInTrash || isInSpam) && (
          <ContextMenuItem
            onSelect={() => run("move-to-inbox", ids, threadIdentifier)}
          >
            <TrayIcon />
            <span>Move to inbox</span>
          </ContextMenuItem>
        )}

        {!isInSpam && !isInTrash && (
          <ContextMenuItem onSelect={() => run("spam", ids, threadIdentifier)}>
            <WarningIcon />
            <span>Move to spam</span>
          </ContextMenuItem>
        )}

        {!isInTrash && (
          <ContextMenuItem
            variant="destructive"
            onSelect={() => run("trash", ids, threadIdentifier)}
          >
            <TrashIcon />
            <span className="flex-1">Move to trash</span>
            <Kbd>{shortcutKey("action:trash")}</Kbd>
          </ContextMenuItem>
        )}

        <ContextMenuSeparator />

        <ContextMenuItem onSelect={handleFindFromSender}>
          <MagnifyingGlassIcon />
          <span>Find emails from sender</span>
        </ContextMenuItem>

        <ContextMenuItem onSelect={() => void handleCopyEmail()}>
          <CopyIcon />
          <span>Copy email address</span>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
