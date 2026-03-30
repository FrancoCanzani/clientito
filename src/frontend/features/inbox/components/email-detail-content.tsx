import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchEmailDetail, fetchEmailThread } from "@/features/inbox/queries";
import {
  ArrowLeftIcon,
  CaretDownIcon,
  CaretUpIcon,
  PaperclipIcon,
} from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import type { EmailListItem } from "../types";
import { formatEmailDetailDate } from "../utils/formatters";
import { AttachmentItem } from "./attachment-item";
import { EmailActionBar } from "./email-action-bar";
import { QuickReply, type QuickReplyHandle } from "./quick-reply";
import { MessageBody, ThreadMessageCard } from "./thread-message-card";

const ATTACHMENT_SKELETON_KEYS = ["attachment-a", "attachment-b"] as const;

function buildRecipientRows(email: EmailListItem) {
  return [
    {
      label: "From",
      value: email.fromName
        ? `${email.fromName} <${email.fromAddr}>`
        : email.fromAddr,
    },
    { label: "To", value: email.toAddr ?? "me" },
    ...(email.ccAddr ? [{ label: "Cc", value: email.ccAddr }] : []),
  ];
}

export function EmailDetailContent({
  email,
  onClose,
  onBack,
  onPrev,
  onNext,
  hasPrev = false,
  hasNext = false,
  onForward,
}: {
  email: EmailListItem;
  onClose?: () => void;
  onBack?: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
  onForward: (initial: import("../types").ComposeInitial) => void;
}) {
  const forward = onForward;
  const formattedDate = formatEmailDetailDate(email.date);
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
    <div className="flex w-full min-w-0 flex-col">
      <div className="sticky top-0 z-10 w-full bg-background pb-3 pt-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-0.5">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-1.5 px-2 text-muted-foreground"
              onClick={() => onBack?.()}
            >
              <ArrowLeftIcon className="size-3.5" />
              Back
            </Button>
            <IconButton
              label="Previous"
              onClick={() => onPrev?.()}
              disabled={!hasPrev}
            >
              <CaretUpIcon className="size-3.5" />
            </IconButton>
            <IconButton
              label="Next"
              onClick={() => onNext?.()}
              disabled={!hasNext}
            >
              <CaretDownIcon className="size-3.5" />
            </IconButton>
          </div>

          {detail ? (
            <EmailActionBar
              email={detail}
              onClose={onClose}
              onForward={forward}
              onReply={() => quickReplyRef.current?.scrollIntoViewAndFocus()}
            />
          ) : null}
        </div>
      </div>

      <div className="mb-5">
        <h1 className="min-w-0 text-lg font-medium text-foreground sm:text-xl">
          {subject}
        </h1>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-x-1 gap-y-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {email.fromName || email.fromAddr}
                </p>
                <span className="truncate text-sm text-muted-foreground">
                  {email.fromAddr}
                </span>
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
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

          <span className="shrink-0 text-xs font-mono tracking-tight font-medium text-muted-foreground">
            {formattedDate}
          </span>
        </div>
      </div>

      <div className="w-full py-5">
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
                  <MessageBody detail={detail} />
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

        {detail && (
          <QuickReply ref={quickReplyRef} email={email} detail={detail} />
        )}
      </div>
    </div>
  );
}
