import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Kbd } from "@/components/ui/kbd";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useAuth } from "@/hooks/use-auth";
import { useMailboxes } from "@/hooks/use-mailboxes";
import type { Icon } from "@phosphor-icons/react";
import {
  ArchiveIcon,
  ArrowBendDoubleUpLeftIcon,
  ArrowBendUpLeftIcon,
  ArrowBendUpRightIcon,
  BellSlashIcon,
  ClockIcon,
  DotsThreeIcon,
  EnvelopeSimpleIcon,
  EnvelopeSimpleOpenIcon,
  StarIcon,
  TrashIcon,
  WarningIcon,
} from "@phosphor-icons/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { unsubscribe } from "../../subscriptions/queries";
import { patchEmail } from "../mutations";
import type { ComposeInitial, EmailDetailItem } from "../types";
import { buildForwardedEmailHtml } from "../utils/build-forwarded-html";
import { formatQuotedDate } from "../utils/formatters";
import { buildReplyAllRecipients } from "../utils/reply-recipients";
import { SnoozePicker } from "./snooze-picker";

type ActionBarProps = {
  email: EmailDetailItem;
  onClose?: () => void;
  onForward?: (initial: ComposeInitial) => void;
  onReply?: () => void;
};

export function EmailActionBar({
  email,
  onClose,
  onForward,
  onReply,
}: ActionBarProps) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const mailboxesQuery = useMailboxes();
  const [moreOpen, setMoreOpen] = useState(false);
  const availableMailboxes = (mailboxesQuery.data?.accounts ?? []).filter(
    (account) => account.mailboxId != null,
  );
  const showReplyAll = availableMailboxes.length > 1;

  const isStarred = email.labelIds.includes("STARRED");
  const isSnoozed =
    email.snoozedUntil != null && email.snoozedUntil > Date.now();
  const hasUnsubscribe = !!(email.unsubscribeUrl || email.unsubscribeEmail);

  const invalidateEmails = () => {
    queryClient.invalidateQueries({ queryKey: ["emails"] });
    queryClient.invalidateQueries({
      queryKey: ["email-detail", email.id],
    });
  };

  const useEmailPatch = (
    payload: Parameters<typeof patchEmail>[1],
    opts: {
      successMessage?: string;
      errorMessage: string;
      closeAfter?: boolean;
    },
  ) =>
    useMutation({
      mutationFn: () => patchEmail(email.id, payload),
      onSuccess: () => {
        if (opts.successMessage) toast.success(opts.successMessage);
        invalidateEmails();
        if (opts.closeAfter) onClose?.();
      },
      onError: () => toast.error(opts.errorMessage),
    });

  const archiveMutation = useEmailPatch(
    { archived: true },
    {
      successMessage: "Archived",
      errorMessage: "Failed to archive",
      closeAfter: true,
    },
  );
  const trashMutation = useEmailPatch(
    { trashed: true },
    {
      successMessage: "Moved to trash",
      errorMessage: "Failed to delete",
      closeAfter: true,
    },
  );
  const spamMutation = useEmailPatch(
    { spam: true },
    {
      successMessage: "Moved to spam",
      errorMessage: "Failed to move to spam",
      closeAfter: true,
    },
  );
  const starMutation = useEmailPatch(
    { starred: !isStarred },
    { errorMessage: "Failed to update" },
  );
  const readMutation = useEmailPatch(
    { isRead: !email.isRead },
    { errorMessage: "Failed to update" },
  );
  const snoozeMutation = useMutation({
    mutationFn: (timestamp: number | null) =>
      patchEmail(email.id, { snoozedUntil: timestamp }),
    onSuccess: (_data, timestamp) => {
      toast.success(timestamp ? "Snoozed" : "Unsnooze");
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
      } else {
        toast.success("Unsubscribed successfully");
      }
    },
    onError: (error) => toast.error(error.message),
  });

  const handleForward = () => {
    const subject = email.subject
      ? email.subject.startsWith("Fwd:")
        ? email.subject
        : `Fwd: ${email.subject}`
      : "Fwd:";
    const bodyHtml = buildForwardedEmailHtml(email);
    onForward?.({ mailboxId: email.mailboxId, subject, bodyHtml });
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
    archiveMutation.isPending ||
    trashMutation.isPending ||
    spamMutation.isPending ||
    starMutation.isPending ||
    readMutation.isPending ||
    snoozeMutation.isPending ||
    unsubscribeMutation.isPending;

  const menuItemClassName =
    "flex min-h-7 w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs/relaxed text-foreground outline-hidden transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50";

  const handleMenuAction = (action: () => void) => {
    setMoreOpen(false);
    action();
  };

  type MenuItem = {
    icon: Icon;
    iconWeight?: "fill" | "regular";
    label: string;
    shortcut?: string;
    action: () => void;
    visible?: boolean;
  };

  const menuItems: MenuItem[] = [
    {
      icon: ArchiveIcon,
      label: "Archive",
      shortcut: "E",
      action: () => archiveMutation.mutate(),
    },
    {
      icon: TrashIcon,
      label: "Move to trash",
      shortcut: "#",
      action: () => trashMutation.mutate(),
    },
    {
      icon: WarningIcon,
      label: "Move to spam",
      action: () => spamMutation.mutate(),
    },
    {
      icon: StarIcon,
      iconWeight: isStarred ? "fill" : "regular",
      label: isStarred ? "Unstar" : "Star",
      shortcut: "S",
      action: () => starMutation.mutate(),
    },
    {
      icon: email.isRead ? EnvelopeSimpleIcon : EnvelopeSimpleOpenIcon,
      label: email.isRead ? "Mark as unread" : "Mark as read",
      shortcut: "U",
      action: () => readMutation.mutate(),
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex gap-2 items-center justify-end">
        <div className="flex flex-wrap items-center gap-0.5">
          <Button type="button" variant="ghost" onClick={() => onReply?.()}>
            <ArrowBendUpLeftIcon className="size-3.5" />
            Reply
            <Kbd className="ml-1">R</Kbd>
          </Button>
          {showReplyAll && (
            <IconButton label="Reply all" onClick={handleReplyAll}>
              <ArrowBendDoubleUpLeftIcon className="size-3.5" />
            </IconButton>
          )}
          <IconButton label="Forward" shortcut="F" onClick={handleForward}>
            <ArrowBendUpRightIcon className="size-3.5" />
          </IconButton>
        </div>

        <div className="flex items-center">
          <Popover open={moreOpen} onOpenChange={setMoreOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-lg"
                disabled={actionsPending}
                aria-label="More actions"
              >
                <DotsThreeIcon className="size-3.5" weight="bold" />
              </Button>
            </PopoverTrigger>

            <PopoverContent align="end" className="w-52 gap-0 p-1">
              {menuItems.map((item) => {
                if (item.visible === false) return null;
                const IconComponent = item.icon;
                return (
                  <button
                    key={item.label}
                    type="button"
                    className={menuItemClassName}
                    disabled={actionsPending}
                    onClick={() => handleMenuAction(item.action)}
                  >
                    <IconComponent
                      className="size-3.5"
                      weight={item.iconWeight}
                    />
                    <span className="flex-1">{item.label}</span>
                    {item.shortcut && (
                      <Kbd className="ml-auto">{item.shortcut}</Kbd>
                    )}
                  </button>
                );
              })}

              {isSnoozed ? (
                <button
                  type="button"
                  className={menuItemClassName}
                  disabled={actionsPending}
                  onClick={() =>
                    handleMenuAction(() => snoozeMutation.mutate(null))
                  }
                >
                  <ClockIcon className="size-3.5" weight="fill" />
                  Unsnooze
                </button>
              ) : (
                <SnoozePicker
                  onSnooze={(timestamp) => {
                    setMoreOpen(false);
                    snoozeMutation.mutate(timestamp);
                  }}
                >
                  <button
                    type="button"
                    className={menuItemClassName}
                    disabled={actionsPending}
                  >
                    <ClockIcon className="size-3.5" />
                    Snooze
                  </button>
                </SnoozePicker>
              )}
              {hasUnsubscribe && (
                <button
                  type="button"
                  className={menuItemClassName}
                  disabled={actionsPending}
                  onClick={() =>
                    handleMenuAction(() => unsubscribeMutation.mutate())
                  }
                >
                  <BellSlashIcon className="size-3.5" />
                  Unsubscribe
                </button>
              )}
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </div>
  );
}
