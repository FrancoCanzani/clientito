import { SnoozePicker } from "@/components/snooze-picker";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { IconButton } from "@/components/ui/icon-button";
import { Kbd } from "@/components/ui/kbd";
import { LabelChip } from "@/features/email/labels/components/label-chip";
import { LabelPicker } from "@/features/email/labels/components/label-picker";
import { removeLabel } from "@/features/email/labels/mutations";
import { fetchLabels } from "@/features/email/labels/queries";
import { labelQueryKeys } from "@/features/email/labels/query-keys";
import { emailQueryKeys } from "@/features/email/mail/query-keys";
import { unsubscribe } from "@/features/email/subscriptions/queries";
import { useAuth } from "@/hooks/use-auth";
import { shortcutKey } from "@/lib/shortcuts";
import type { Icon } from "@phosphor-icons/react";
import {
  ArrowBendDoubleUpLeftIcon,
  ArrowBendUpLeftIcon,
  ArrowBendUpRightIcon,
  BellSlashIcon,
  CheckIcon,
  ClockIcon,
  DotsThreeIcon,
  EnvelopeSimpleIcon,
  EnvelopeSimpleOpenIcon,
  ProhibitIcon,
  SparkleIcon,
  StarIcon,
  TagIcon,
  TrashIcon,
  TrayIcon,
  WarningIcon,
} from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import type { useMailActions } from "../hooks/use-mail-actions";
import { useUndoAction } from "../hooks/use-undo-action";
import { blockSender, patchEmail, patchThread } from "../mutations";
import { invalidateInboxQueries } from "../data/invalidation";
import type { ComposeInitial, EmailDetailItem } from "../types";
import { buildForwardedEmailHtml } from "../utils/build-forwarded-html";
import { formatQuotedDate } from "../utils/formatters";
import { buildReplyAllRecipients } from "../utils/reply-recipients";

type EmailActionsProps = {
  email: EmailDetailItem;
  onClose?: () => void;
  onForward?: (initial: ComposeInitial) => void;
  onReply?: () => void;
  onDraftReply?: () => void;
  onAction?: ReturnType<typeof useMailActions>["executeEmailAction"];
};

type EmailPatchPayload = Parameters<typeof patchEmail>[1];

type EmailPatchOptions = {
  successMessage?: string;
  errorMessage?: string;
  closeAfter?: boolean;
};

export function EmailActions({
  email,
  onClose,
  onForward,
  onReply,
  onDraftReply,
  onAction,
}: EmailActionsProps) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const navigate = useNavigate();
  const { user } = useAuth();
  const showReplyAll =
    Boolean(email.ccAddr?.trim()) || (email.toAddr?.split(",").length ?? 0) > 1;

  const isStarred = email.labelIds.includes("STARRED");
  const isInInbox = email.labelIds.includes("INBOX");
  const isSpam = email.labelIds.includes("SPAM");
  const isSnoozed =
    email.snoozedUntil != null && email.snoozedUntil > Date.now();
  const hasUnsubscribe = Boolean(
    email.unsubscribeUrl || email.unsubscribeEmail,
  );
  const hasAiDraftReply = Boolean(email.aiDraftReply?.trim());
  const mailboxId = email.mailboxId;
  const resolvedMailboxId = mailboxId ?? 0;

  const labelsQuery = useQuery({
    queryKey: labelQueryKeys.list(resolvedMailboxId),
    queryFn: () => fetchLabels(resolvedMailboxId),
    staleTime: 60_000,
    enabled: mailboxId != null,
  });
  const allLabels = labelsQuery.data ?? [];
  const userLabelIds = email.labelIds.filter((id) => id.startsWith("Label_"));
  const appliedLabels = allLabels.filter((l) =>
    userLabelIds.includes(l.gmailId),
  );

  const invalidateEmails = () => {
    invalidateInboxQueries();
    queryClient.invalidateQueries({
      queryKey: emailQueryKeys.detail(email.id),
    });
    void router.invalidate();
  };

  const emailIdentifier = {
    id: email.id,
    providerMessageId: email.providerMessageId,
    mailboxId: resolvedMailboxId,
    labelIds: email.labelIds,
  };
  const threadIdentifier = email.threadId
    ? {
        threadId: email.threadId,
        mailboxId: resolvedMailboxId,
        labelIds: email.labelIds,
      }
    : null;
  const patchThreadOrEmail = (payload: EmailPatchPayload) =>
    threadIdentifier
      ? patchThread(threadIdentifier, payload)
      : patchEmail(emailIdentifier, payload);

  const emailPatchMutation = useMutation({
    mutationFn: (payload: EmailPatchPayload) =>
      patchEmail(emailIdentifier, payload),
  });
  const threadPatchMutation = useMutation({
    mutationFn: (payload: EmailPatchPayload) => patchThreadOrEmail(payload),
  });

  const runEmailPatch = (
    payload: EmailPatchPayload,
    opts: EmailPatchOptions = {},
  ) => {
    emailPatchMutation.mutate(payload, {
      onSuccess: () => {
        if (opts.successMessage) toast.success(opts.successMessage);
        if (opts.closeAfter) onClose?.();
      },
      onError: () => {
        toast.error(opts.errorMessage ?? "Failed to update");
      },
    });
  };

  const runThreadPatch = (
    payload: EmailPatchPayload,
    opts: EmailPatchOptions = {},
  ) => {
    threadPatchMutation.mutate(payload, {
      onSuccess: () => {
        if (opts.successMessage) toast.success(opts.successMessage);
        if (opts.closeAfter) onClose?.();
      },
      onError: () => {
        toast.error(opts.errorMessage ?? "Failed to update");
      },
    });
  };

  const snoozeMutation = useMutation({
    mutationFn: (timestamp: number | null) =>
      patchEmail(emailIdentifier, { snoozedUntil: timestamp }),
    onSuccess: (_data, timestamp) => {
      toast.success(timestamp ? "Snoozed" : "Unsnoozed");
      if (timestamp && mailboxId != null) {
        void navigate({ to: "/$mailboxId/inbox", params: { mailboxId } });
      }
    },
    onError: () => toast.error("Failed to snooze"),
  });

  const removeLabelMutation = useMutation({
    mutationFn: (labelId: string) =>
      removeLabel([email.providerMessageId], labelId, resolvedMailboxId),
    onError: (error: Error) =>
      toast.error(error.message || "Failed to remove label"),
  });

  const unsubscribeMutation = useMutation({
    mutationFn: () =>
      unsubscribe({
        fromAddr: email.fromAddr,
        unsubscribeUrl: email.unsubscribeUrl ?? undefined,
        unsubscribeEmail: email.unsubscribeEmail ?? undefined,
      }),
    onSuccess: (result) => {
      if (result.method === "manual" && result.url) {
        window.open(result.url, "_blank", "noopener,noreferrer");
        toast.info("Opened unsubscribe page in a new tab");
        return;
      }
      const archived = result.archivedCount ?? 0;
      toast.success(
        archived > 0
          ? `Unsubscribed — ${archived} ${archived === 1 ? "email" : "emails"} archived`
          : "Unsubscribed",
      );
      invalidateEmails();
      onClose?.();
    },
    onError: (error) => toast.error(error.message),
  });

  const undoAction = useUndoAction();
  const [blockConfirmOpen, setBlockConfirmOpen] = useState(false);
  const [unsubscribeConfirmOpen, setUnsubscribeConfirmOpen] = useState(false);

  const blockSenderMutation = useMutation({
    mutationFn: () =>
      blockSender({
        fromAddr: email.fromAddr,
        mailboxId: email.mailboxId ?? undefined,
      }),
    onSuccess: (result) => {
      toast.success(
        result.trashedCount > 0
          ? `Blocked — ${result.trashedCount} ${result.trashedCount === 1 ? "email" : "emails"} trashed`
          : "Sender blocked",
      );
      invalidateEmails();
      onClose?.();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (mailboxId == null) return null;

  const handleForward = () => {
    const subject = email.subject
      ? email.subject.startsWith("Fwd:")
        ? email.subject
        : `Fwd: ${email.subject}`
      : "Fwd:";

    onForward?.({
      mailboxId: email.mailboxId,
      subject,
      bodyHtml: buildForwardedEmailHtml(email),
    });
  };

  const handleReplyAll = () => {
    const myEmail = user?.email?.toLowerCase() ?? "";
    const { replyTo, cc } = buildReplyAllRecipients(
      email.fromAddr,
      email.toAddr,
      email.ccAddr,
      myEmail,
    );

    const subject = email.subject
      ? email.subject.startsWith("Re:")
        ? email.subject
        : `Re: ${email.subject}`
      : "Re:";

    const originalFrom = email.fromName
      ? `${email.fromName} &lt;${email.fromAddr}&gt;`
      : email.fromAddr;
    const originalDate = formatQuotedDate(email.date);
    const originalBody =
      email.resolvedBodyHtml ?? email.resolvedBodyText ?? email.bodyText ?? "";
    const quotedHtml = `<br><br><div style="border-left:2px solid #ccc;padding-left:12px;margin-left:0;color:#555">On ${originalDate}, ${originalFrom} wrote:<br>${originalBody}</div>`;

    onForward?.({
      mailboxId: email.mailboxId,
      to: replyTo,
      cc,
      subject,
      body: quotedHtml,
    });
  };

  const actionsPending =
    emailPatchMutation.isPending ||
    threadPatchMutation.isPending ||
    snoozeMutation.isPending ||
    unsubscribeMutation.isPending ||
    blockSenderMutation.isPending;

  const runCentralAction = (
    action: Parameters<NonNullable<typeof onAction>>[0],
    opts: { closeAfter?: boolean; thread?: boolean } = {},
  ) => {
    if (!onAction) return false;
    void onAction(
      action,
      [email.id],
      opts.thread ? (threadIdentifier ?? undefined) : undefined,
      {
        identifiers: [emailIdentifier],
        onVisible: opts.closeAfter ? () => onClose?.() : undefined,
      },
    );
    return true;
  };

  const primaryAction = isInInbox
    ? "archive"
    : isSpam
      ? "not-spam"
      : "move-to-inbox";
  const PrimaryActionIcon = isInInbox ? CheckIcon : TrayIcon;
  const primaryActionLabel = isInInbox
    ? "Done"
    : isSpam
      ? "Not spam"
      : "Move to inbox";

  const handlePrimaryAction = () => {
    if (primaryAction === "not-spam") {
      return (
        runCentralAction("not-spam", {
          closeAfter: true,
          thread: true,
        }) ||
        runThreadPatch(
          { spam: false },
          { successMessage: "Moved to inbox", closeAfter: true },
        )
      );
    }
    return (
      runCentralAction(primaryAction, {
        closeAfter: true,
        thread: true,
      }) ||
      undoAction({
        action: () => patchThreadOrEmail({ archived: isInInbox }),
        onAction: () => onClose?.(),
        message: isInInbox ? "Marked as done" : "Moved to inbox",
      })
    );
  };

  const handleTrash = () =>
    runCentralAction("trash", { closeAfter: true, thread: true }) ||
    undoAction({
      action: () => patchThreadOrEmail({ trashed: true }),
      onAction: () => onClose?.(),
      message: "Moved to trash",
    });

  type MenuAction = {
    icon: Icon;
    iconWeight?: "fill" | "regular";
    label: string;
    shortcutId?: string;
    action: () => void;
  };

  const overflowActions: MenuAction[] = [
    {
      icon: StarIcon,
      iconWeight: isStarred ? "fill" : "regular",
      label: isStarred ? "Unstar" : "Star",
      shortcutId: "action:star",
      action: () =>
        runCentralAction(isStarred ? "unstar" : "star") ||
        runEmailPatch({ starred: !isStarred }),
    },
    {
      icon: email.isRead ? EnvelopeSimpleIcon : EnvelopeSimpleOpenIcon,
      label: email.isRead ? "Mark as unread" : "Mark as read",
      shortcutId: "action:toggle-read",
      action: () =>
        runCentralAction(email.isRead ? "mark-unread" : "mark-read", {
          thread: true,
        }) || runThreadPatch({ isRead: !email.isRead }),
    },
    {
      icon: isSpam ? TrayIcon : WarningIcon,
      label: isSpam ? "Not spam" : "Move to spam",
      action: () => {
        if (isSpam) {
          return (
            runCentralAction("not-spam", { closeAfter: true, thread: true }) ||
            runThreadPatch(
              { spam: false },
              { successMessage: "Moved to inbox", closeAfter: true },
            )
          );
        }
        return (
          runCentralAction("spam", { closeAfter: true, thread: true }) ||
          undoAction({
            action: () => patchThreadOrEmail({ spam: true }),
            onAction: () => onClose?.(),
            message: "Moved to spam",
          })
        );
      },
    },
  ];

  return (
    <div className="flex items-center gap-1">
      <IconButton
        label={primaryActionLabel}
        shortcut={shortcutKey("action:archive")}
        variant="ghost"
        size="icon-sm"
        disabled={actionsPending}
        onClick={handlePrimaryAction}
      >
        <PrimaryActionIcon className="size-3.5" />
      </IconButton>
      <IconButton
        label="Delete"
        shortcut={shortcutKey("action:trash")}
        variant="ghost"
        size="icon-sm"
        disabled={actionsPending}
        onClick={handleTrash}
      >
        <TrashIcon className="size-3.5" />
      </IconButton>

      {email.mailboxId != null && (
        <LabelPicker
          mailboxId={email.mailboxId}
          emailIds={[email.providerMessageId]}
          appliedLabelIds={email.labelIds}
          onDone={invalidateEmails}
          trigger={
            <IconButton
              label="Label"
              variant="ghost"
              size="icon-sm"
            >
              <TagIcon className="size-3.5" />
            </IconButton>
          }
        />
      )}

      {appliedLabels.map((label) => (
        <LabelChip
          label={label}
          key={label.gmailId}
          onRemove={() => removeLabelMutation.mutate(label.gmailId)}
        />
      ))}

      <div className="hidden items-center gap-0.5 sm:flex">
        <IconButton
          label="Reply"
          shortcut={shortcutKey("action:reply")}
          variant="ghost"
          size="icon-sm"
          onClick={() => onReply?.()}
        >
          <ArrowBendUpLeftIcon className="size-3.5" />
        </IconButton>
        {hasAiDraftReply && (
          <IconButton
            label="Draft reply"
            variant="ghost"
            size="icon-sm"
            onClick={() => onDraftReply?.()}
          >
            <SparkleIcon className="size-3.5" />
          </IconButton>
        )}
        {showReplyAll && (
          <IconButton
            label="Reply all"
            variant="ghost"
            size="icon-sm"
            onClick={handleReplyAll}
          >
            <ArrowBendDoubleUpLeftIcon className="size-3.5" />
          </IconButton>
        )}
        <IconButton
          label="Forward"
          shortcut={shortcutKey("action:forward")}
          variant="ghost"
          size="icon-sm"
          onClick={handleForward}
        >
          <ArrowBendUpRightIcon className="size-3.5" />
        </IconButton>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={actionsPending}
            aria-label="More actions"
          >
            <DotsThreeIcon className="size-3.5" weight="bold" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" className="min-w-fit">
          <div className="sm:hidden">
            <DropdownMenuItem onSelect={() => onReply?.()}>
              <ArrowBendUpLeftIcon className="size-3.5" />
              <span className="flex-1">Reply</span>
              <Kbd>{shortcutKey("action:reply")}</Kbd>
            </DropdownMenuItem>
            {hasAiDraftReply && (
              <DropdownMenuItem onSelect={() => onDraftReply?.()}>
                <SparkleIcon className="size-3.5" />
                <span className="flex-1">Draft reply</span>
              </DropdownMenuItem>
            )}
            {showReplyAll && (
              <DropdownMenuItem onSelect={handleReplyAll}>
                <ArrowBendDoubleUpLeftIcon className="size-3.5" />
                <span className="flex-1">Reply all</span>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onSelect={handleForward}>
              <ArrowBendUpRightIcon className="size-3.5" />
              <span className="flex-1">Forward</span>
              <Kbd>{shortcutKey("action:forward")}</Kbd>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </div>

          {overflowActions.map((item) => {
            const IconComponent = item.icon;
            return (
              <DropdownMenuItem
                key={item.label}
                disabled={actionsPending}
                onSelect={item.action}
              >
                <IconComponent className="size-3.5" weight={item.iconWeight} />
                <span className="flex-1">{item.label}</span>
                {item.shortcutId && <Kbd>{shortcutKey(item.shortcutId)}</Kbd>}
              </DropdownMenuItem>
            );
          })}
          <DropdownMenuSeparator />
          {isSnoozed ? (
            <DropdownMenuItem
              disabled={actionsPending}
              onSelect={() => snoozeMutation.mutate(null)}
            >
              <ClockIcon className="size-3.5" weight="fill" />
              <span className="flex-1">Unsnooze</span>
            </DropdownMenuItem>
          ) : (
            <SnoozePicker
              onSnooze={(timestamp) => snoozeMutation.mutate(timestamp)}
            >
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={actionsPending}
                className="h-auto w-full justify-start px-2 py-1 text-xs/relaxed"
              >
                <ClockIcon className="size-3.5" />
                Snooze
              </Button>
            </SnoozePicker>
          )}
          {hasUnsubscribe && (
            <DropdownMenuItem
              disabled={actionsPending}
              onSelect={(event) => {
                event.preventDefault();
                setUnsubscribeConfirmOpen(true);
              }}
            >
              <BellSlashIcon className="size-3.5" />
              <span className="flex-1">Unsubscribe</span>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            disabled={actionsPending}
            onSelect={(event) => {
              event.preventDefault();
              setBlockConfirmOpen(true);
            }}
          >
            <ProhibitIcon className="size-3.5" />
            <span className="flex-1">Block sender</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog
        open={unsubscribeConfirmOpen}
        onOpenChange={setUnsubscribeConfirmOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Unsubscribe from {email.fromAddr}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              You'll be removed from this mailing list. Existing emails from{" "}
              {email.fromAddr} will also be moved to Archive.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                setUnsubscribeConfirmOpen(false);
                unsubscribeMutation.mutate();
              }}
            >
              Unsubscribe
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={blockConfirmOpen} onOpenChange={setBlockConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Block {email.fromAddr}?</AlertDialogTitle>
            <AlertDialogDescription>
              Future emails from {email.fromAddr} will be sent to Trash.
              Existing emails from this sender will also be moved to Trash. You
              can undo this in Gmail Settings &rarr; Filters.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                setBlockConfirmOpen(false);
                blockSenderMutation.mutate();
              }}
            >
              Block sender
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
