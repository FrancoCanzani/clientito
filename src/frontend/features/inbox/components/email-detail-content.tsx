import { Skeleton } from "@/components/ui/skeleton";
import { fetchEmailDetail, fetchEmailThread } from "@/features/inbox/queries";
import {
  CaretDownIcon,
  CaretRightIcon,
  PaperclipIcon,
} from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { type ReactNode, useMemo, useState } from "react";
import type { EmailDetailItem, EmailListItem } from "../types";
import { prepareEmailHtml } from "../utils/prepare-email-html";
import { AttachmentItem } from "./attachment-item";
import type { ComposeInitial } from "./compose-email-dialog";
import { EmailActionBar } from "./email-action-bar";
import { EmailHtmlRenderer } from "./email-html-renderer";

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

function renderMessageBody(detail?: EmailDetailItem | null) {
  const bodyHtml = detail?.resolvedBodyHtml ?? detail?.bodyHtml;
  const bodyText = detail?.resolvedBodyText ?? detail?.bodyText;
  const preparedHtml = bodyHtml ? prepareEmailHtml(bodyHtml) : null;

  if (preparedHtml) {
    return <EmailHtmlRenderer html={preparedHtml} />;
  }

  return (
    <pre className="whitespace-pre-wrap text-xs leading-relaxed text-foreground">
      {bodyText ?? ""}
    </pre>
  );
}

type ThreadMessageCardProps = {
  email: EmailListItem;
  detail?: EmailDetailItem | null;
  expanded: boolean;
  onToggle: () => void;
  showAttachments: boolean;
  attachmentLoading: boolean;
  attachmentError: boolean;
};

function ThreadMessageCard({
  email,
  detail,
  expanded,
  onToggle,
  showAttachments,
  attachmentLoading,
  attachmentError,
}: ThreadMessageCardProps) {
  const formattedDate = new Date(email.date).toLocaleString();
  const attachments = detail?.attachments ?? [];

  return (
    <div className="relative pl-6">
      <span
        className="absolute top-0 bottom-0 left-2 w-px bg-border/70"
        aria-hidden
      />
      <div className="relative rounded-xl border border-border/70 bg-card/40 p-3">
        <span className="absolute -left-5.5 top-5 size-3 rounded-full border border-border bg-background" />
        <button
          type="button"
          onClick={onToggle}
          className="flex w-full items-start gap-3 text-left transition-colors hover:text-foreground"
        >
          {expanded ? (
            <CaretDownIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          ) : (
            <CaretRightIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          )}
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {formatParticipant(email)}
                </p>
                <p className="text-xs text-muted-foreground">{formattedDate}</p>
              </div>
              {!expanded && (
                <p className="max-w-120 truncate text-xs text-muted-foreground">
                  {buildPreview(email, detail)}
                </p>
              )}
            </div>
          </div>
        </button>

        {expanded && (
          <div className="mt-3 space-y-3 pl-7">
            {showAttachments && (
              <section className="space-y-2">
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                  <PaperclipIcon className="size-3.5" />
                  Attachments
                </div>
                {attachmentLoading ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {Array.from({ length: 2 }).map((_, index) => (
                      <Skeleton key={index} className="h-16 rounded-xl" />
                    ))}
                  </div>
                ) : attachmentError ? (
                  <p className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">
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

            <div className="min-w-0">{renderMessageBody(detail)}</div>
          </div>
        )}
      </div>
    </div>
  );
}

export function EmailDetailContent({
  email,
  onClose,
  onForward,
  headerActions,
}: {
  email: EmailListItem;
  onClose?: () => void;
  onForward?: (initial: ComposeInitial) => void;
  headerActions?: ReactNode;
}) {
  const formattedDate = new Date(email.date).toLocaleString();
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

  return (
    <div className="flex h-full w-full min-h-0 min-w-0 flex-col items-start overflow-hidden space-y-4">
      <div className="w-full shrink-0 space-y-3 border-b border-border/70 pb-3">
        <div className="flex items-start justify-between gap-3">
          <h1 className="min-w-0 flex-1 text-lg font-semibold tracking-tight">
            {subject}
          </h1>
          {headerActions ? (
            <div className="flex shrink-0 items-center gap-1">
              {headerActions}
            </div>
          ) : null}
        </div>
        {detail && (
          <EmailActionBar
            email={detail}
            onClose={onClose}
            onForward={onForward}
          />
        )}
        <div className="space-y-1 text-xs leading-relaxed">
          <div className="flex items-center justify-start gap-2">
            <span className="font-medium">{formatParticipant(email)}</span>
            <span className="font-mono tracking-tight">{formattedDate}</span>
          </div>
        </div>
      </div>

      <div className="min-h-0 w-full flex-1 overflow-y-auto">
        {detailQuery.isPending && !showThreadTimeline ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-[85%]" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : (
          <div className="space-y-4">
            {detailQuery.isError && (
              <p className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                We could not fetch email detail.
              </p>
            )}

            {threadQuery.isError && showThreadTimeline && (
              <p className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                We could not load the full thread.
              </p>
            )}

            {showThreadTimeline ? (
              <section className="space-y-3">
                <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                  Thread
                </div>
                <div className="space-y-3">
                  {threadMessages.map((threadEmail) => {
                    const isExpanded = isThreadMessageExpanded(threadEmail.id);
                    const isSelectedMessage = threadEmail.id === email.id;

                    return (
                      <ThreadMessageCard
                        key={threadEmail.id}
                        email={threadEmail}
                        detail={isSelectedMessage ? detail : null}
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
              <div className="space-y-4">
                {hasSelectedAttachments && (
                  <section className="space-y-2">
                    <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                      <PaperclipIcon className="size-3.5" />
                      Attachments
                    </div>
                    {liveQuery.isPending ? (
                      <div className="grid gap-2 sm:grid-cols-2">
                        {Array.from({ length: 2 }).map((_, index) => (
                          <Skeleton key={index} className="h-16 rounded-xl" />
                        ))}
                      </div>
                    ) : liveQuery.isError ? (
                      <p className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">
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

                <div className="min-w-0">{renderMessageBody(detail)}</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
