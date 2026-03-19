import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ArchiveIcon,
  ArrowBendUpLeftIcon,
  ArrowBendUpRightIcon,
  BellSlashIcon,
  EnvelopeSimpleIcon,
  EnvelopeSimpleOpenIcon,
  StarIcon,
  TrashIcon,
  UsersThreeIcon,
  WarningIcon,
} from "@phosphor-icons/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { unsubscribe } from "../../subscriptions/queries";
import { draftReply, patchEmail, sendEmail } from "../mutations";
import type { EmailDetailItem } from "../types";
import type { ComposeInitial } from "./compose-email-dialog";

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
          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted/60 hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
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

  const sendMutation = useMutation({
    mutationFn: () =>
      sendEmail({
        to: email.fromAddr,
        subject: email.subject
          ? email.subject.startsWith("Re:")
            ? email.subject
            : `Re: ${email.subject}`
          : "Re:",
        body: replyBody,
        inReplyTo: email.gmailId,
        threadId: email.threadId ?? undefined,
      }),
    onSuccess: () => {
      toast.success("Reply sent");
      setReplyBody("");
      setReplyOpen(false);
      invalidateEmails();
    },
    onError: (error) => toast.error(error.message),
  });

  const draftMutation = useMutation({
    mutationFn: () => draftReply({ emailId: Number(email.id) }),
    onSuccess: (result) => {
      setReplyBody(result.draft);
      setReplyOpen(true);
      setTimeout(() => textareaRef.current?.focus(), 0);
    },
    onError: () => toast.error("AI service unavailable"),
  });

  const handleForward = () => {
    const subject = email.subject
      ? email.subject.startsWith("Fwd:")
        ? email.subject
        : `Fwd: ${email.subject}`
      : "Fwd:";
    const body = [
      "---------- Forwarded message ----------",
      `From: ${email.fromName ? `${email.fromName} <${email.fromAddr}>` : email.fromAddr}`,
      `Date: ${new Date(email.date).toLocaleString()}`,
      `Subject: ${email.subject ?? "(no subject)"}`,
      "",
      email.resolvedBodyText ?? email.bodyText ?? "",
    ].join("\n");

    onForward?.({ subject, body });
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

    onForward?.({
      to: replyTo,
      cc: uniqueCc || undefined,
      subject,
      body: "",
    });
  };

  const actionsPending =
    archiveMutation.isPending ||
    trashMutation.isPending ||
    spamMutation.isPending ||
    starMutation.isPending ||
    readMutation.isPending ||
    unsubscribeMutation.isPending;

  return (
    <div className="space-y-3">
      {replyOpen && (
        <div className="space-y-2">
          <Textarea
            ref={textareaRef}
            value={replyBody}
            onChange={(e) => setReplyBody(e.target.value)}
            placeholder="Write your reply..."
            className="min-h-20 resize-none text-sm"
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                if (replyBody.trim().length > 0 && !sendMutation.isPending) {
                  sendMutation.mutate();
                }
              }
              if (e.key === "Escape") {
                e.preventDefault();
                setReplyOpen(false);
                setReplyBody("");
              }
            }}
          />
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => draftMutation.mutate()}
              disabled={draftMutation.isPending}
              className="gap-1.5 text-xs"
            >
              {draftMutation.isPending ? "Drafting..." : "Draft"}
            </Button>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setReplyOpen(false);
                  setReplyBody("");
                }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => sendMutation.mutate()}
                disabled={
                  sendMutation.isPending || replyBody.trim().length === 0
                }
              >
                {sendMutation.isPending ? "Sending..." : "Send"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <TooltipProvider>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
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
              className="gap-1.5 text-xs"
              onClick={handleReplyAll}
            >
              <UsersThreeIcon className="size-3.5" />
              Reply All
            </Button>
          </div>

          <div className="flex items-center gap-0.5">
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
            <ActionButton label="Forward" onClick={handleForward}>
              <ArrowBendUpRightIcon className="size-4" />
            </ActionButton>
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
      </TooltipProvider>
    </div>
  );
}
