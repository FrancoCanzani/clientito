import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import {
  ArchiveIcon,
  ArrowBendUpLeftIcon,
  ArrowBendUpRightIcon,
  BellSlashIcon,
  ClockIcon,
  EnvelopeSimpleIcon,
  EnvelopeSimpleOpenIcon,
  StarIcon,
  TrashIcon,
  UsersThreeIcon,
  WarningIcon,
} from "@phosphor-icons/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { unsubscribe } from "../../subscriptions/queries";
import { useUndoSend } from "../hooks/use-undo-send";
import { patchEmail, sendEmail } from "../mutations";
import type { ComposeInitial, EmailDetailItem } from "../types";
import { SnoozePicker } from "./snooze-picker";

type ActionBarProps = {
  email: EmailDetailItem;
  onClose?: () => void;
  onForward?: (initial: ComposeInitial) => void;
};

function ActionButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          disabled={disabled}
          className="flex size-8 items-center justify-center text-muted-foreground transition-[transform,color,background-color] duration-150 ease-out hover:bg-muted/50 hover:text-foreground active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40"
          aria-label={label}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

function extractEmailAddress(raw: string): string {
  const match = raw.match(/<([^>]+)>/);
  return (match?.[1] ?? raw).trim().toLowerCase();
}

function parseRecipientList(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => extractEmailAddress(s))
    .filter((s) => s.length > 0);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildForwardedEmailHtml(email: EmailDetailItem) {
  const fromLine = email.fromName
    ? `${escapeHtml(email.fromName)} &lt;${escapeHtml(email.fromAddr)}&gt;`
    : escapeHtml(email.fromAddr);
  const dateLine = new Date(email.date).toLocaleString();
  const subjectLine = escapeHtml(email.subject ?? "(no subject)");
  const toLine = email.toAddr?.trim() ? escapeHtml(email.toAddr) : null;
  const ccLine = email.ccAddr?.trim() ? escapeHtml(email.ccAddr) : null;
  const originalBody = email.resolvedBodyHtml?.trim().length
    ? email.resolvedBodyHtml
    : email.bodyHtml?.trim().length
      ? email.bodyHtml
      : `<div style="white-space:pre-wrap">${escapeHtml(
          email.resolvedBodyText ?? email.bodyText ?? "",
        )}</div>`;

  return [
    "<p><br></p>",
    '<div data-forwarded-message="true" style="border-top:1px solid #dadce0;margin-top:16px;padding-top:16px;color:#5f6368;font-size:13px">',
    '<div data-forwarded-header="true">---------- Forwarded message ---------</div>',
    `<div><strong>From:</strong> ${fromLine}</div>`,
    `<div><strong>Date:</strong> ${escapeHtml(dateLine)}</div>`,
    `<div><strong>Subject:</strong> ${subjectLine}</div>`,
    ...(toLine ? [`<div><strong>To:</strong> ${toLine}</div>`] : []),
    ...(ccLine ? [`<div><strong>Cc:</strong> ${ccLine}</div>`] : []),
    "<br>",
    `<div data-forwarded-original-body="true">${originalBody}</div>`,
    "</div>",
  ].join("");
}

export function EmailActionBar({ email, onClose, onForward }: ActionBarProps) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyBody, setReplyBody] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isStarred = email.labelIds.includes("STARRED");

  const invalidateEmails = () => {
    void queryClient.invalidateQueries({ queryKey: ["emails"] });
    void queryClient.invalidateQueries({
      queryKey: ["email-detail", email.id],
    });
  };

  const archiveMutation = useMutation({
    mutationFn: () => patchEmail(email.id, { archived: true }),
    onSuccess: () => {
      toast.success("Archived");
      invalidateEmails();
      onClose?.();
    },
    onError: () => toast.error("Failed to archive"),
  });

  const trashMutation = useMutation({
    mutationFn: () => patchEmail(email.id, { trashed: true }),
    onSuccess: () => {
      toast.success("Moved to trash");
      invalidateEmails();
      onClose?.();
    },
    onError: () => toast.error("Failed to delete"),
  });

  const spamMutation = useMutation({
    mutationFn: () => patchEmail(email.id, { spam: true }),
    onSuccess: () => {
      toast.success("Moved to spam");
      invalidateEmails();
      onClose?.();
    },
    onError: () => toast.error("Failed to move to spam"),
  });

  const starMutation = useMutation({
    mutationFn: () => patchEmail(email.id, { starred: !isStarred }),
    onSuccess: () => {
      invalidateEmails();
    },
    onError: () => toast.error("Failed to update"),
  });

  const readMutation = useMutation({
    mutationFn: () => patchEmail(email.id, { isRead: !email.isRead }),
    onSuccess: () => {
      invalidateEmails();
    },
    onError: () => toast.error("Failed to update"),
  });

  const isSnoozed =
    email.snoozedUntil != null && email.snoozedUntil > Date.now();

  const snoozeMutation = useMutation({
    mutationFn: (timestamp: number | null) =>
      patchEmail(email.id, { snoozedUntil: timestamp }),
    onSuccess: (_data, timestamp) => {
      toast.success(timestamp ? "Snoozed" : "Unsnooze");
      invalidateEmails();
    },
    onError: () => toast.error("Failed to snooze"),
  });

  const hasUnsubscribe = !!(email.unsubscribeUrl || email.unsubscribeEmail);

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

  const replyBodySnapshotRef = useRef("");
  const [replySendPending, setReplySendPending] = useState(false);

  const undoReplySend = useUndoSend({
    onSend: () => {
      const body = replyBodySnapshotRef.current;
      const originalFrom = email.fromName
        ? `${email.fromName} <${email.fromAddr}>`
        : email.fromAddr;
      const originalDate = new Date(email.date).toLocaleString();
      const originalText = (email.resolvedBodyText ?? email.bodyText ?? "")
        .split("\n")
        .map((line) => `> ${line}`)
        .join("\n");
      const quotedBody = `${body}\n\nOn ${originalDate}, ${originalFrom} wrote:\n${originalText}`;

      return sendEmail({
        mailboxId: email.mailboxId ?? undefined,
        to: email.fromAddr,
        subject: email.subject
          ? email.subject.startsWith("Re:")
            ? email.subject
            : `Re: ${email.subject}`
          : "Re:",
        body: quotedBody,
        inReplyTo: email.providerMessageId,
        threadId: email.threadId ?? undefined,
      });
    },
    onSuccess: () => {
      toast.success("Reply sent");
      setReplySendPending(false);
      invalidateEmails();
    },
    onError: (error) => {
      setReplySendPending(false);
      toast.error(error.message);
    },
  });

  const triggerReplySend = useCallback(() => {
    replyBodySnapshotRef.current = replyBody;
    setReplySendPending(true);
    setReplyBody("");
    setReplyOpen(false);
    undoReplySend.trigger();
  }, [replyBody, undoReplySend]);

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
    const toRecipients = parseRecipientList(email.toAddr);
    const ccRecipients = parseRecipientList(email.ccAddr);
    const fromAddr = extractEmailAddress(email.fromAddr);

    // "To" is the original sender
    const replyTo = fromAddr;

    // "CC" is everyone else from To + CC, excluding the user and the original sender
    const allOthers = [...toRecipients, ...ccRecipients].filter(
      (addr) => addr !== myEmail && addr !== fromAddr,
    );
    const uniqueCc = [...new Set(allOthers)].join(", ");

    const subject = email.subject
      ? email.subject.startsWith("Re:")
        ? email.subject
        : `Re: ${email.subject}`
      : "Re:";

    const originalFrom = email.fromName
      ? `${email.fromName} &lt;${email.fromAddr}&gt;`
      : email.fromAddr;
    const originalDate = new Date(email.date).toLocaleString();
    const originalBody =
      email.resolvedBodyHtml ?? email.resolvedBodyText ?? email.bodyText ?? "";
    const quotedHtml = `<br><br><div style="border-left:2px solid #ccc;padding-left:12px;margin-left:0;color:#555">On ${originalDate}, ${originalFrom} wrote:<br>${originalBody}</div>`;

    onForward?.({
      mailboxId: email.mailboxId,
      to: replyTo,
      cc: uniqueCc || undefined,
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

  return (
    <div className="space-y-3">
      {replyOpen && (
        <div className="border-l border-border/80 pl-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-foreground">Quick reply</p>
              <p className="text-xs text-muted-foreground">
                Send with Cmd+Enter
              </p>
            </div>
            <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Reply
            </span>
          </div>
          <Textarea
            ref={textareaRef}
            value={replyBody}
            onChange={(e) => setReplyBody(e.target.value)}
            placeholder="Write your reply..."
            className="min-h-28 resize-none rounded-none border-x-0 border-t-0 border-b border-border/70 bg-transparent px-0 py-0 text-sm leading-7 shadow-none focus-visible:ring-0"
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                if (replyBody.trim().length > 0 && !replySendPending) {
                  triggerReplySend();
                }
              }
              if (e.key === "Escape") {
                e.preventDefault();
                setReplyOpen(false);
                setReplyBody("");
              }
            }}
          />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              Esc closes the draft
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="rounded-full px-3"
                onClick={() => {
                  setReplyOpen(false);
                  setReplyBody("");
                }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="rounded-full px-3"
                onClick={() => triggerReplySend()}
                disabled={replySendPending || replyBody.trim().length === 0}
              >
                {replySendPending ? "Sending..." : "Send"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={replyOpen ? "default" : "secondary"}
            size="sm"
            className="h-8 rounded-full px-3 text-xs shadow-none"
            onClick={() => {
              setReplyOpen(true);
              setTimeout(() => textareaRef.current?.focus(), 0);
            }}
          >
            <ArrowBendUpLeftIcon className="size-3.5" />
            Reply
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 rounded-full px-3 text-xs"
            onClick={handleReplyAll}
          >
            <UsersThreeIcon className="size-3.5" />
            Reply all
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 rounded-full px-3 text-xs"
            onClick={handleForward}
          >
            <ArrowBendUpRightIcon className="size-3.5" />
            Forward
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-0.5">
          <ActionButton
            label="Archive"
            onClick={() => archiveMutation.mutate()}
            disabled={actionsPending}
          >
            <ArchiveIcon className="size-4" />
          </ActionButton>
          <ActionButton
            label="Delete"
            onClick={() => trashMutation.mutate()}
            disabled={actionsPending}
          >
            <TrashIcon className="size-4" />
          </ActionButton>
          <ActionButton
            label="Move to spam"
            onClick={() => spamMutation.mutate()}
            disabled={actionsPending}
          >
            <WarningIcon className="size-4" />
          </ActionButton>
          <ActionButton
            label={isStarred ? "Unstar" : "Star"}
            onClick={() => starMutation.mutate()}
            disabled={actionsPending}
          >
            <StarIcon
              className="size-4"
              weight={isStarred ? "fill" : "regular"}
            />
          </ActionButton>
          <ActionButton
            label={email.isRead ? "Mark unread" : "Mark read"}
            onClick={() => readMutation.mutate()}
            disabled={actionsPending}
          >
            {email.isRead ? (
              <EnvelopeSimpleIcon className="size-4" />
            ) : (
              <EnvelopeSimpleOpenIcon className="size-4" />
            )}
          </ActionButton>
          {isSnoozed ? (
            <ActionButton
              label="Unsnooze"
              onClick={() => snoozeMutation.mutate(null)}
              disabled={actionsPending}
            >
              <ClockIcon className="size-4" weight="fill" />
            </ActionButton>
          ) : (
            <SnoozePicker onSnooze={(ts) => snoozeMutation.mutate(ts)}>
              <span>
                <ActionButton
                  label="Snooze"
                  onClick={() => {}}
                  disabled={actionsPending}
                >
                  <ClockIcon className="size-4" />
                </ActionButton>
              </span>
            </SnoozePicker>
          )}
          {hasUnsubscribe && (
            <ActionButton
              label="Unsubscribe"
              onClick={() => unsubscribeMutation.mutate()}
              disabled={actionsPending}
            >
              <BellSlashIcon className="size-4" />
            </ActionButton>
          )}
        </div>
      </div>
    </div>
  );
}
