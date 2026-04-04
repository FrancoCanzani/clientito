import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { useEmailAiActions } from "@/features/inbox/hooks/use-email-ai-actions";
import { patchEmail } from "@/features/inbox/mutations";
import {
  fetchEmailSummary,
  fetchEmailThread,
  fetchEmailDetailAI,
} from "@/features/inbox/queries";
import { fetchTasks } from "@/features/tasks/queries";
import {
  ArrowLeftIcon,
  CaretDownIcon,
  CaretUpIcon,
  PaperclipIcon,
} from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import { toast } from "sonner";
import { formatEmailDetailDate } from "../utils/formatters";
import { AttachmentItem } from "./attachment-item";
import { EmailActionBar } from "./email-action-bar";
import { EmailOverviewPanel } from "./email-overview-panel";
import { QuickReply, type QuickReplyHandle } from "./quick-reply";
import { MessageBody, ThreadMessageCard } from "./thread-message-card";

const detailRoute = getRouteApi("/_dashboard/inbox/$id/email/$emailId");

function buildRecipientRows(
  email: ReturnType<typeof detailRoute.useLoaderData>["email"],
) {
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
  onClose,
  onBack,
  onPrev,
  onNext,
  hasPrev = false,
  hasNext = false,
  onForward,
  replyTriggerRef,
}: {
  onClose?: () => void;
  onBack?: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
  onForward: (initial: import("../types").ComposeInitial) => void;
  replyTriggerRef?: RefObject<{ trigger: () => void } | null>;
}) {
  const { email } = detailRoute.useLoaderData();
  const queryClient = useQueryClient();
  const formattedDate = formatEmailDetailDate(email.date);
  const quickReplyRef = useRef<QuickReplyHandle>(null);
  const [threadExpansionOverrides, setThreadExpansionOverrides] = useState<
    Map<string, boolean>
  >(() => new Map());

  const threadQuery = useQuery({
    queryKey: ["email-thread", email.threadId],
    queryFn: () => fetchEmailThread(email.threadId!),
    enabled: Boolean(email.threadId),
    staleTime: 60_000,
  });

  const detailAIQuery = useQuery({
    queryKey: ["email-ai-detail", email.id],
    queryFn: () => fetchEmailDetailAI(email.id),
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
    retry: 2,
  });
  const intelligence = detailAIQuery.data ?? null;

  const linkedTasksQuery = useQuery({
    queryKey: ["tasks", "source-email", Number(email.id)],
    queryFn: () => fetchTasks({ sourceEmailId: Number(email.id) }),
    enabled: intelligence != null,
    staleTime: 60_000,
  });
  const linkedTasks = linkedTasksQuery.data?.data ?? [];

  const { aiActionMutation, handleAiAction } = useEmailAiActions({
    email,
    onClose,
    onReplyRequested: (draft) =>
      quickReplyRef.current?.scrollIntoViewAndFocus(draft),
  });

  const summaryQuery = useQuery({
    queryKey: ["email-ai-summary", email.id],
    queryFn: () => fetchEmailSummary(email.id),
    enabled: intelligence != null && !intelligence.summary,
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
  });
  const summary = intelligence?.summary || summaryQuery.data || null;

  const markSpamMutation = useMutation({
    mutationFn: async () => {
      await patchEmail(email.id, { spam: true });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["emails"] }),
        queryClient.invalidateQueries({ queryKey: ["email-detail", email.id] }),
        queryClient.invalidateQueries({
          queryKey: ["email-ai-detail", email.id],
        }),
        email.threadId
          ? queryClient.invalidateQueries({
              queryKey: ["email-thread", email.threadId],
            })
          : Promise.resolve(),
      ]);
      toast.success("Moved to spam");
      onClose?.();
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to move email to spam",
      );
    },
  });

  const threadMessages = useMemo(() => {
    if (!email.threadId) return [email];
    return threadQuery.data?.length ? threadQuery.data : [email];
  }, [email, threadQuery.data]);

  const defaultExpandedThreadIds = useMemo(() => {
    const next = new Set<string>();
    const selectedThreadMessage = threadMessages.find(
      (threadMessage) => threadMessage.id === email.id,
    );
    if (selectedThreadMessage) {
      next.add(selectedThreadMessage.id);
    } else {
      next.add(email.id);
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
  const hasSelectedAttachments = email.attachments.length > 0;
  const subject = email.subject ?? "(no subject)";
  const recipientRows = buildRecipientRows(email);

  useEffect(() => {
    if (replyTriggerRef) {
      replyTriggerRef.current = {
        trigger: () => quickReplyRef.current?.scrollIntoViewAndFocus(),
      };
    }
    return () => {
      if (replyTriggerRef) replyTriggerRef.current = null;
    };
  }, [replyTriggerRef]);

  return (
    <div className="flex w-full min-w-0 flex-col space-y-8">
      <div className="sticky top-0 z-10 w-full bg-background pt-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-0.5">
            <Button type="button" variant="ghost" onClick={() => onBack?.()}>
              <ArrowLeftIcon className="size-3.5" />
              Back
            </Button>
            <IconButton
              label="Previous"
              shortcut="K"
              onClick={() => onPrev?.()}
              disabled={!hasPrev}
            >
              <CaretUpIcon className="size-3.5" />
            </IconButton>
            <IconButton
              label="Next"
              shortcut="J"
              onClick={() => onNext?.()}
              disabled={!hasNext}
            >
              <CaretDownIcon className="size-3.5" />
            </IconButton>
          </div>

          <EmailActionBar
            email={email}
            onClose={onClose}
            onForward={onForward}
            onReply={() => quickReplyRef.current?.scrollIntoViewAndFocus()}
          />
        </div>
      </div>

      <div className="space-y-2">
        <h1 className="min-w-0 font-medium text-foreground">{subject}</h1>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="min-w-0 space-y-1">
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

          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
            {formattedDate}
          </span>
        </div>
      </div>

      <div className="w-full">
        <div className="space-y-8">
          {intelligence && (
            <EmailOverviewPanel
              intelligence={intelligence}
              summary={summary}
              summaryLoading={summaryQuery.isFetching}
              onAiAction={handleAiAction}
              aiActionPending={aiActionMutation.isPending}
              linkedTasks={linkedTasks}
              onMarkSpam={() => markSpamMutation.mutate()}
              spamPending={markSpamMutation.isPending}
            />
          )}

          {detailAIQuery.isError && (
            <p className="rounded-2xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              We could not load the AI overview.
            </p>
          )}

          {threadQuery.isError && showThreadTimeline && (
            <p className="rounded-2xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              We could not load the full thread.
            </p>
          )}

          {showThreadTimeline ? (
            <section className="space-y-3">
              <div className="space-y-2">
                {threadMessages.map((threadEmail) => {
                  const isExpanded = isThreadMessageExpanded(threadEmail.id);
                  const isSelectedMessage = threadEmail.id === email.id;

                  return (
                    <ThreadMessageCard
                      key={threadEmail.id}
                      email={threadEmail}
                      body={isSelectedMessage ? email : threadEmail}
                      expanded={isExpanded}
                      onToggle={() => toggleThreadMessage(threadEmail.id)}
                      attachments={isSelectedMessage ? email.attachments : []}
                    />
                  );
                })}
              </div>
            </section>
          ) : (
            <div>
              <div className="min-w-0">
                <MessageBody detail={email} />
              </div>

              {hasSelectedAttachments && (
                <section className="mt-5 space-y-3 border-t border-border/70 pt-5">
                  <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    <PaperclipIcon className="size-3" />
                    Attachments
                  </div>
                  {email.attachments.length > 0 ? (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {email.attachments.map((attachment) => (
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

        <QuickReply ref={quickReplyRef} email={email} detail={email} />
      </div>
    </div>
  );
}
