import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchEmailDetail, fetchEmailThread } from "@/features/inbox/queries";
import { cn } from "@/lib/utils";
import {
  ArrowBendUpLeftIcon,
  CaretDownIcon,
  CaretRightIcon,
  DotsThreeIcon,
  PaperPlaneTiltIcon,
  PaperclipIcon,
} from "@phosphor-icons/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  type ReactNode,
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import type { EmailDetailItem, EmailListItem } from "../types";
import { sendEmail } from "../mutations";
import { useAttachmentUpload } from "../hooks/use-attachment-upload";
import { AttachmentBar } from "./attachment-bar";
import { prepareEmailHtml } from "../utils/prepare-email-html";
import { AttachmentItem } from "./attachment-item";
import { EmailActionBar } from "./email-action-bar";
import { EmailHtmlRenderer } from "./email-html-renderer";

const ATTACHMENT_SKELETON_KEYS = ["attachment-a", "attachment-b"] as const;

function formatDateTime(value: number) {
  return new Date(value).toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatThreadDate(value: number) {
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatSenderName(email: EmailListItem) {
  return email.fromName || email.fromAddr;
}

function formatParticipant(email: EmailListItem) {
  return email.fromName
    ? `${email.fromName} <${email.fromAddr}>`
    : email.fromAddr;
}

function buildPreview(email: EmailListItem, detail?: EmailDetailItem | null) {
  const rawText =
    detail?.resolvedBodyText ?? detail?.snippet ?? email.snippet ?? "";

  const firstLine = rawText
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 0);

  return firstLine ?? "(no preview available)";
}

function buildRecipientRows(email: EmailListItem) {
  return [
    { label: "From", value: formatParticipant(email) },
    { label: "To", value: email.toAddr ?? "me" },
    ...(email.ccAddr ? [{ label: "Cc", value: email.ccAddr }] : []),
  ];
}

function getSenderInitial(email: EmailListItem) {
  const value = email.fromName?.trim() || email.fromAddr.trim();
  return value.charAt(0).toUpperCase();
}

function MessageBody({
  detail,
  previewText,
}: {
  detail?: EmailDetailItem | null;
  previewText?: string;
}) {
  const bodyHtml = detail?.resolvedBodyHtml ?? detail?.bodyHtml;
  const bodyText = detail?.resolvedBodyText ?? detail?.bodyText;
  const preparedHtml = bodyHtml ? prepareEmailHtml(bodyHtml) : null;

  if (preparedHtml) {
    return <EmailHtmlRenderer html={preparedHtml} />;
  }

  return (
    <div className="whitespace-pre-wrap text-sm leading-7 text-foreground/88">
      {bodyText ?? previewText ?? ""}
    </div>
  );
}

type ThreadMessageCardProps = {
  email: EmailListItem;
  detail?: EmailDetailItem | null;
  active: boolean;
  expanded: boolean;
  onToggle: () => void;
  showAttachments: boolean;
  attachmentLoading: boolean;
  attachmentError: boolean;
};

function ThreadMessageCard({
  email,
  detail,
  active,
  expanded,
  onToggle,
  showAttachments,
  attachmentLoading,
  attachmentError,
}: ThreadMessageCardProps) {
  const formattedDate = formatThreadDate(email.date);
  const attachments = detail?.attachments ?? [];
  const preview = buildPreview(email, detail);

  return (
    <div
      className={cn(
        "border-b border-border/70 transition-colors duration-150 ease-out last:border-b-0",
        active && "bg-muted/[0.12]",
      )}
    >
      <div className="relative">
        <button
          type="button"
          onClick={onToggle}
          className="flex w-full items-start gap-3 px-0 py-3 text-left transition-[color,transform] duration-150 ease-out hover:text-foreground active:scale-[0.995]"
        >
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted/[0.55] text-xs font-medium text-foreground/75">
            {getSenderInitial(email)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-medium text-foreground">
                    {formatSenderName(email)}
                  </p>
                  {active && (
                    <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                      Open
                    </span>
                  )}
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {email.fromAddr}
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="font-mono tracking-tight">
                  {formattedDate}
                </span>
                {expanded ? (
                  <CaretDownIcon className="size-4 shrink-0" />
                ) : (
                  <CaretRightIcon className="size-4 shrink-0" />
                )}
              </div>
            </div>
            {!expanded && (
              <p className="mt-2 truncate text-sm text-muted-foreground">
                {preview}
              </p>
            )}
          </div>
        </button>

        {expanded && (
          <div className="border-t border-border/50 pb-4 pt-4">
            <div className="ml-11 space-y-4">
              <div className="min-w-0">
                <MessageBody detail={detail} previewText={preview} />
              </div>

              {showAttachments && (
                <section className="space-y-1 border-t border-border/50 pt-4">
                  <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    <PaperclipIcon className="size-3" />
                    Attachments
                  </div>
                  {attachmentLoading ? (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {ATTACHMENT_SKELETON_KEYS.map((key) => (
                        <Skeleton key={key} className="h-16 rounded-2xl" />
                      ))}
                    </div>
                  ) : attachmentError ? (
                    <p className="rounded-2xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                      We could not load attachments for this message.
                    </p>
                  ) : attachments.length > 0 ? (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {attachments.map((attachment) => (
                        <AttachmentItem
                          key={attachment.attachmentId}
                          attachment={attachment}
                        />
                      ))}
                    </div>
                  ) : null}
                </section>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export type QuickReplyHandle = {
  scrollIntoViewAndFocus: () => void;
};

function buildQuotedText(email: EmailListItem, detail?: EmailDetailItem | null) {
  const bodyText = detail?.resolvedBodyText ?? detail?.bodyText ?? email.snippet ?? "";
  const from = email.fromName
    ? `${email.fromName} <${email.fromAddr}>`
    : email.fromAddr;
  const date = new Date(email.date).toLocaleString();
  return `On ${date}, ${from} wrote:\n${bodyText}`;
}

const QuickReply = forwardRef<
  QuickReplyHandle,
  { email: EmailListItem; detail?: EmailDetailItem | null }
>(function QuickReply({ email, detail }, ref) {
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [focused, setFocused] = useState(false);
  const [showQuoted, setShowQuoted] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const attachments = useAttachmentUpload();

  useImperativeHandle(ref, () => ({
    scrollIntoViewAndFocus: () => {
      setFocused(true);
      containerRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
      setTimeout(() => textareaRef.current?.focus(), 300);
    },
  }));

  const handleSend = useCallback(async () => {
    const trimmed = body.trim();
    if (!trimmed || sending) return;

    setSending(true);
    try {
      const subject = email.subject
        ? `Re: ${email.subject.replace(/^Re:\s*/i, "")}`
        : "Re:";
      const attachmentKeys = attachments.files.length > 0
        ? attachments.getAttachmentKeys()
        : undefined;
      await sendEmail({
        mailboxId: email.mailboxId ?? undefined,
        to: email.fromAddr,
        subject,
        body: `<div style="white-space:pre-wrap">${trimmed.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>`,
        threadId: email.threadId ?? undefined,
        attachments: attachmentKeys,
      });
      setBody("");
      setFocused(false);
      attachments.clear();
      toast.success("Reply sent");
      void queryClient.invalidateQueries({ queryKey: ["emails"] });
      void queryClient.invalidateQueries({ queryKey: ["email-thread", email.threadId] });
    } catch {
      toast.error("Failed to send reply");
    } finally {
      setSending(false);
    }
  }, [body, sending, email, queryClient, attachments]);

  const quotedText = buildQuotedText(email, detail);

  if (!focused) {
    return (
      <div ref={containerRef} className="mt-6">
        <button
          type="button"
          onClick={() => {
            setFocused(true);
            setTimeout(() => textareaRef.current?.focus(), 0);
          }}
          className="flex w-full items-center gap-2 rounded-lg border border-border/50 px-4 py-3 text-sm text-muted-foreground transition-colors hover:border-border hover:text-foreground"
        >
          <ArrowBendUpLeftIcon className="size-4 shrink-0" />
          Click here to reply
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="mt-6">
      <div className="rounded-lg border border-border bg-background">
        <div className="flex items-center gap-2 border-b border-border/50 px-4 py-2">
          <ArrowBendUpLeftIcon className="size-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">
            to {email.fromName || email.fromAddr}
          </span>
        </div>

        <div className="px-4 py-3">
          <textarea
            ref={textareaRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                handleSend();
              }
              if (e.key === "Escape") {
                if (!body.trim()) {
                  setFocused(false);
                } else {
                  e.currentTarget.blur();
                }
              }
            }}
            placeholder="Write your reply..."
            rows={4}
            className="w-full resize-none bg-transparent text-sm leading-relaxed text-foreground outline-none placeholder:text-muted-foreground"
          />

          <div className="mt-2">
            <button
              type="button"
              onClick={() => setShowQuoted(!showQuoted)}
              className="inline-flex items-center justify-center rounded border border-border/60 px-1.5 py-0.5 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
              title={showQuoted ? "Hide quoted text" : "Show quoted text"}
            >
              <DotsThreeIcon className="size-4" weight="bold" />
            </button>

            {showQuoted && (
              <div className="mt-2 whitespace-pre-wrap border-l-2 border-border/60 pl-3 text-xs leading-relaxed text-muted-foreground">
                {quotedText}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-border/30 px-4 py-2">
          <AttachmentBar
            files={attachments.files}
            uploading={attachments.uploading}
            onAddFiles={(files) => attachments.addFiles(files)}
            onRemoveFile={attachments.removeFile}
          />
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => {
                setFocused(false);
                setBody("");
                setShowQuoted(false);
                attachments.clear();
              }}
            >
              Discard
            </Button>
            <Button
              size="sm"
              className="h-7 px-3"
              disabled={!body.trim() || sending}
              onClick={handleSend}
            >
              <PaperPlaneTiltIcon className="mr-1 size-3" />
              {sending ? "Sending..." : "Send"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
});

export function EmailDetailContent({
  email,
  onClose,
  headerActions,
  onForward,
}: {
  email: EmailListItem;
  onClose?: () => void;
  headerActions?: ReactNode;
  onForward: (initial: import("../types").ComposeInitial) => void;
}) {
  const forward = onForward;
  const formattedDate = formatDateTime(email.date);
  const quickReplyRef = useRef<QuickReplyHandle>(null);
  const [threadExpansionOverrides, setThreadExpansionOverrides] = useState<
    Map<string, boolean>
  >(() => new Map());

  const detailQuery = useQuery({
    queryKey: ["email-detail", email.id],
    queryFn: () => fetchEmailDetail(email.id),
    staleTime: 60_000,
  });

  const liveQuery = useQuery({
    queryKey: ["email-detail-live", email.id],
    queryFn: () => fetchEmailDetail(email.id, { refreshLive: true }),
    enabled: true,
    staleTime: 60_000,
    retry: 2,
  });

  const threadQuery = useQuery({
    queryKey: ["email-thread", email.threadId],
    queryFn: () => fetchEmailThread(email.threadId!),
    enabled: Boolean(email.threadId),
    staleTime: 60_000,
  });

  const detail = liveQuery.data ?? detailQuery.data ?? null;
  const threadMessages = useMemo(() => {
    if (!email.threadId) {
      return [email];
    }

    return threadQuery.data?.length ? threadQuery.data : [email];
  }, [email, threadQuery.data]);
  const defaultExpandedThreadIds = useMemo(() => {
    const next = new Set<string>([email.id]);
    const mostRecentThreadMessage = threadMessages[threadMessages.length - 1];
    if (mostRecentThreadMessage) {
      next.add(mostRecentThreadMessage.id);
    }
    return next;
  }, [email.id, threadMessages]);

  const isThreadMessageExpanded = (messageId: string) =>
    threadExpansionOverrides.get(messageId) ??
    defaultExpandedThreadIds.has(messageId);

  const toggleThreadMessage = (messageId: string) => {
    setThreadExpansionOverrides((current) => {
      const next = new Map(current);
      next.set(messageId, !isThreadMessageExpanded(messageId));
      return next;
    });
  };

  const showThreadTimeline = Boolean(
    email.threadId && threadMessages.length > 1,
  );
  const hasSelectedAttachments =
    email.hasAttachment || (detail?.attachments?.length ?? 0) > 0;
  const subject = email.subject ?? "(no subject)";
  const recipientRows = buildRecipientRows(email);

  return (
    <div className="flex h-full w-full min-h-0 min-w-0 flex-col overflow-hidden">
      <div className="w-full shrink-0 border-b border-border/70 pb-5">
        <div className="flex items-start justify-between gap-4">
          <h1 className="min-w-0 flex-1 text-lg font-semibold tracking-[-0.01em] text-foreground sm:text-xl">
            {subject}
          </h1>
          {headerActions ? (
            <div className="flex shrink-0 items-center gap-1">
              {headerActions}
            </div>
          ) : null}
        </div>

        <div className="mt-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium text-foreground">
                {getSenderInitial(email)}
              </div>
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {formatSenderName(email)}
                  </p>
                  <span className="truncate text-sm text-muted-foreground">
                    {email.fromAddr}
                  </span>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  {recipientRows.map((row) => (
                    <p key={row.label} className="min-w-0">
                      <span className="mr-1 font-medium text-foreground/70">
                        {row.label}
                      </span>
                      <span>{row.value}</span>
                    </p>
                  ))}
                </div>
              </div>
            </div>

            <div className="shrink-0 text-xs font-medium text-muted-foreground">
              <span className="font-mono tracking-tight">{formattedDate}</span>
            </div>
          </div>

          {detail && (
            <div className="mt-4 pt-1">
              <EmailActionBar
                email={detail}
                onClose={onClose}
                onForward={forward}
                onReply={() => quickReplyRef.current?.scrollIntoViewAndFocus()}
              />
            </div>
          )}
        </div>
      </div>

      <div className="min-h-0 w-full flex-1 overflow-y-auto py-5">
        {detailQuery.isPending && !showThreadTimeline ? (
          <div className="space-y-3">
            <Skeleton className="h-12 w-full rounded-[24px]" />
            <Skeleton className="h-12 w-[82%] rounded-[24px]" />
            <Skeleton className="h-72 w-full rounded-[28px]" />
          </div>
        ) : (
          <div className="space-y-4">
            {detailQuery.isError && (
              <p className="rounded-2xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                We could not fetch email detail.
              </p>
            )}

            {threadQuery.isError && showThreadTimeline && (
              <p className="rounded-2xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                We could not load the full thread.
              </p>
            )}

            {showThreadTimeline ? (
              <section className="space-y-3">
                <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  Conversation
                </div>
                <div className="space-y-2">
                  {threadMessages.map((threadEmail) => {
                    const isExpanded = isThreadMessageExpanded(threadEmail.id);
                    const isSelectedMessage = threadEmail.id === email.id;

                    return (
                      <ThreadMessageCard
                        key={threadEmail.id}
                        email={threadEmail}
                        detail={isSelectedMessage ? detail : null}
                        active={isSelectedMessage}
                        expanded={isExpanded}
                        onToggle={() => toggleThreadMessage(threadEmail.id)}
                        showAttachments={
                          isSelectedMessage && hasSelectedAttachments
                        }
                        attachmentLoading={
                          isSelectedMessage &&
                          hasSelectedAttachments &&
                          liveQuery.isPending
                        }
                        attachmentError={
                          isSelectedMessage &&
                          hasSelectedAttachments &&
                          liveQuery.isError
                        }
                      />
                    );
                  })}
                </div>
              </section>
            ) : (
              <div>
                <div className="min-w-0">
                  <MessageBody
                    detail={detail}
                    previewText={buildPreview(email, detail)}
                  />
                </div>

                {hasSelectedAttachments && (
                  <section className="space-y-3 border-t border-border/70 pt-5 mt-5">
                    <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                      <PaperclipIcon className="size-3" />
                      Attachments
                    </div>
                    {liveQuery.isPending ? (
                      <div className="grid gap-2 sm:grid-cols-2">
                        {ATTACHMENT_SKELETON_KEYS.map((key) => (
                          <Skeleton key={key} className="h-16 rounded-2xl" />
                        ))}
                      </div>
                    ) : liveQuery.isError ? (
                      <p className="rounded-2xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                        We could not load live attachment data.
                      </p>
                    ) : detail?.attachments?.length ? (
                      <div className="grid gap-2 sm:grid-cols-2">
                        {detail.attachments.map((attachment) => (
                          <AttachmentItem
                            key={attachment.attachmentId}
                            attachment={attachment}
                          />
                        ))}
                      </div>
                    ) : null}
                  </section>
                )}
              </div>
            )}
          </div>
        )}

        {detail && <QuickReply ref={quickReplyRef} email={email} detail={detail} />}
      </div>
    </div>
  );
}
