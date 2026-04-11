import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { IconButton } from "@/components/ui/icon-button";
import { useAuth } from "@/hooks/use-auth";
import { useMailboxes } from "@/hooks/use-mailboxes";
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
  StarIcon,
  TrashIcon,
  WarningIcon,
} from "@phosphor-icons/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { unsubscribe } from "../../../subscriptions/queries";
import { patchEmail } from "../../mutations";
import type { ComposeInitial, EmailDetailItem } from "../../types";
import { buildForwardedEmailHtml } from "../../utils/build-forwarded-html";
import { formatQuotedDate } from "../../utils/formatters";
import { buildReplyAllRecipients } from "../../utils/reply-recipients";
import { SnoozePicker } from "../shell/snooze-picker";

type EmailActionsProps = {
  email: EmailDetailItem;
  onClose?: () => void;
  onForward?: (initial: ComposeInitial) => void;
  onReply?: () => void;
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

  const invalidateEmails = () => {
    queryClient.invalidateQueries({ queryKey: ["emails"] });
    queryClient.invalidateQueries({ queryKey: ["email-detail", email.id] });
    void router.invalidate();
  };

  const emailPatchMutation = useMutation({
    mutationFn: (payload: EmailPatchPayload) => patchEmail(email.id, payload),
  });

  const runEmailPatch = (
    payload: EmailPatchPayload,
    opts: EmailPatchOptions = {},
  ) => {
    emailPatchMutation.mutate(payload, {
      onSuccess: () => {
        if (opts.successMessage) toast.success(opts.successMessage);
        invalidateEmails();
        if (opts.closeAfter) onClose?.();
      },
      onError: () => {
        toast.error(opts.errorMessage ?? "Failed to update");
      },
    });
  };

  const snoozeMutation = useMutation({
    mutationFn: (timestamp: number | null) =>
      patchEmail(email.id, { snoozedUntil: timestamp }),
    onSuccess: (_data, timestamp) => {
      toast.success(timestamp ? "Snoozed" : "Unsnoozed");
      invalidateEmails();
    },
    onError: () => toast.error("Failed to snooze"),
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
    unsubscribeMutation.isPending;

  type MenuAction = {
    icon: Icon;
    iconWeight?: "fill" | "regular";
    label: string;
    action: () => void;
  };

  const menuActions: MenuAction[] = [
    {
      icon: CheckIcon,
      label: isInInbox ? "Done" : "Move to inbox",
      action: () =>
        runEmailPatch(
          { archived: isInInbox },
          {
            successMessage: isInInbox ? "Marked as done" : "Moved to inbox",
            errorMessage: isInInbox
              ? "Failed to mark as done"
              : "Failed to move to inbox",
            closeAfter: true,
          },
        ),
    },
    {
      icon: TrashIcon,
      label: "Move to trash",
      action: () =>
        runEmailPatch(
          { trashed: true },
          {
            successMessage: "Moved to trash",
            errorMessage: "Failed to delete",
            closeAfter: true,
          },
        ),
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
    {
      icon: StarIcon,
      iconWeight: isStarred ? "fill" : "regular",
      label: isStarred ? "Unstar" : "Star",
      action: () => runEmailPatch({ starred: !isStarred }),
    },
    {
      icon: email.isRead ? EnvelopeSimpleIcon : EnvelopeSimpleOpenIcon,
      label: email.isRead ? "Mark as unread" : "Mark as read",
      action: () => runEmailPatch({ isRead: !email.isRead }),
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end gap-2">
        <div className="flex flex-wrap items-center gap-0.5">
          <IconButton
            label="Reply"
            shortcut="R"
            variant="ghost"
            onClick={() => onReply?.()}
          >
            <ArrowBendUpLeftIcon className="size-3.5" />
          </IconButton>
          {showReplyAll && (
            <IconButton label="Reply all" onClick={handleReplyAll}>
              <ArrowBendDoubleUpLeftIcon className="size-3.5" />
            </IconButton>
          )}
          <IconButton label="Forward" onClick={handleForward}>
            <ArrowBendUpRightIcon className="size-3.5" />
          </IconButton>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-lg"
              disabled={actionsPending}
              aria-label="More actions"
            >
              <DotsThreeIcon className="size-3.5" weight="bold" />
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent>
            {menuActions.map((item) => {
              const IconComponent = item.icon;
              return (
                <DropdownMenuItem
                  key={item.label}
                  disabled={actionsPending}
                  onSelect={item.action}
                >
                  <IconComponent
                    className="size-3.5"
                    weight={item.iconWeight}
                  />
                  <span className="flex-1">{item.label}</span>
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
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
