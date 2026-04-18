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
import { useAuth } from "@/hooks/use-auth";
import { useMailboxes } from "@/hooks/use-mailboxes";
import { queryKeys } from "@/lib/query-keys";
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
  WarningIcon,
} from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { unsubscribe } from "../../../subscriptions/queries";
import { blockSender, patchEmail } from "../../mutations";
import { invalidateInboxQueries } from "../../queries";
import type { ComposeInitial, EmailDetailItem } from "../../types";
import { buildForwardedEmailHtml } from "../../utils/build-forwarded-html";
import { formatQuotedDate } from "../../utils/formatters";
import { buildReplyAllRecipients } from "../../utils/reply-recipients";

type EmailActionsProps = {
  email: EmailDetailItem;
  onClose?: () => void;
  onForward?: (initial: ComposeInitial) => void;
  onReply?: () => void;
  onDraftReply?: () => void;
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
}: EmailActionsProps) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { user } = useAuth();
  const mailboxesQuery = useMailboxes();

  const availableMailboxes = (mailboxesQuery.data?.accounts ?? []).filter(
    (account) => account.mailboxId != null,
  );
  const showReplyAll = availableMailboxes.length > 1;

  const isStarred = email.labelIds.includes("STARRED");
  const isInInbox = email.labelIds.includes("INBOX");
  const isSnoozed =
    email.snoozedUntil != null && email.snoozedUntil > Date.now();
  const hasUnsubscribe = Boolean(
    email.unsubscribeUrl || email.unsubscribeEmail,
  );
  const hasAiDraftReply = Boolean(email.aiDraftReply?.trim());
  const mailboxId = email.mailboxId;

  if (mailboxId == null) return null;

  const labelsQuery = useQuery({
    queryKey: queryKeys.labels(mailboxId),
    queryFn: () => fetchLabels(mailboxId),
    staleTime: 60_000,
    enabled: true,
  });
  const allLabels = labelsQuery.data ?? [];
  const userLabelIds = email.labelIds.filter((id) => id.startsWith("Label_"));
  const appliedLabels = allLabels.filter((l) =>
    userLabelIds.includes(l.gmailId),
  );

  const invalidateEmails = () => {
    invalidateInboxQueries();
    queryClient.invalidateQueries({
      queryKey: queryKeys.emails.detail(email.id),
    });
    void router.invalidate();
  };

  const emailIdentifier = {
    id: email.id,
    providerMessageId: email.providerMessageId,
    mailboxId,
    labelIds: email.labelIds,
  };

  const emailPatchMutation = useMutation({
    mutationFn: (payload: EmailPatchPayload) =>
      patchEmail(emailIdentifier, payload),
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

  const snoozeMutation = useMutation({
    mutationFn: (timestamp: number | null) =>
      patchEmail(emailIdentifier, { snoozedUntil: timestamp }),
    onSuccess: (_data, timestamp) => {
      toast.success(timestamp ? "Snoozed" : "Unsnoozed");
    },
    onError: () => toast.error("Failed to snooze"),
  });

  const removeLabelMutation = useMutation({
    mutationFn: (labelId: string) =>
      removeLabel([email.providerMessageId], labelId, mailboxId),
    onSuccess: () => invalidateEmails(),
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

      toast.success("Unsubscribed successfully");
    },
    onError: (error) => toast.error(error.message),
  });

  const [blockConfirmOpen, setBlockConfirmOpen] = useState(false);

  const blockSenderMutation = useMutation({
    mutationFn: () =>
      blockSender({
        fromAddr: email.fromAddr,
        mailboxId: email.mailboxId ?? undefined,
      }),
    onSuccess: (result) => {
      toast.success(
        result.trashedCount > 0
          ? `Blocked ${result.fromAddr} \u2014 moved ${result.trashedCount} ${result.trashedCount === 1 ? "email" : "emails"} to trash. Manage filters in Gmail.`
          : `Blocked ${result.fromAddr}. Manage filters in Gmail.`,
      );
      invalidateEmails();
      onClose?.();
    },
    onError: (error: Error) => toast.error(error.message),
  });

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
    snoozeMutation.isPending ||
    unsubscribeMutation.isPending ||
    blockSenderMutation.isPending;

  const handleDone = () =>
    runEmailPatch(
      { archived: isInInbox },
      {
        successMessage: isInInbox ? "Marked as done" : "Moved to inbox",
        errorMessage: isInInbox
          ? "Failed to mark as done"
          : "Failed to move to inbox",
        closeAfter: true,
      },
    );

  const handleTrash = () =>
    runEmailPatch(
      { trashed: true },
      {
        successMessage: "Moved to trash",
        errorMessage: "Failed to delete",
        closeAfter: true,
      },
    );

  type MenuAction = {
    icon: Icon;
    iconWeight?: "fill" | "regular";
    label: string;
    shortcut?: string;
    action: () => void;
  };

  const overflowActions: MenuAction[] = [
    {
      icon: StarIcon,
      iconWeight: isStarred ? "fill" : "regular",
      label: isStarred ? "Unstar" : "Star",
      shortcut: "S",
      action: () => runEmailPatch({ starred: !isStarred }),
    },
    {
      icon: email.isRead ? EnvelopeSimpleIcon : EnvelopeSimpleOpenIcon,
      label: email.isRead ? "Mark as unread" : "Mark as read",
      shortcut: "U",
      action: () => runEmailPatch({ isRead: !email.isRead }),
    },
    {
      icon: WarningIcon,
      label: "Move to spam",
      action: () =>
        runEmailPatch(
          { spam: true },
          {
            successMessage: "Moved to spam",
            errorMessage: "Failed to move to spam",
            closeAfter: true,
          },
        ),
    },
  ];

  return (
    <div className="flex items-center gap-0.5">
      <IconButton
        label={isInInbox ? "Done" : "Move to inbox"}
        shortcut="E"
        variant="ghost"
        disabled={actionsPending}
        onClick={handleDone}
      >
        <CheckIcon className="size-3.5" />
      </IconButton>
      <IconButton
        label="Delete"
        shortcut="#"
        variant="ghost"
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
            <IconButton label="Label" shortcut="L" variant="ghost">
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
          shortcut="R"
          variant="ghost"
          onClick={() => onReply?.()}
        >
          <ArrowBendUpLeftIcon className="size-3.5" />
        </IconButton>
        {hasAiDraftReply && (
          <IconButton
            label="Draft reply"
            variant="ghost"
            onClick={() => onDraftReply?.()}
          >
            <SparkleIcon className="size-3.5" />
          </IconButton>
        )}
        {showReplyAll && (
          <IconButton
            label="Reply all"
            variant="ghost"
            onClick={handleReplyAll}
          >
            <ArrowBendDoubleUpLeftIcon className="size-3.5" />
          </IconButton>
        )}
        <IconButton
          label="Forward"
          shortcut="F"
          variant="ghost"
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
            size="icon"
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
              <Kbd>R</Kbd>
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
              <Kbd>F</Kbd>
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
                {item.shortcut && <Kbd>{item.shortcut}</Kbd>}
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
              onSelect={() => unsubscribeMutation.mutate()}
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
