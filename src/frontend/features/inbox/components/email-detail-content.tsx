import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Skeleton } from "@/components/ui/skeleton";
import { patchEmail } from "@/features/inbox/mutations";
import {
  fetchEmailDetailAI,
  fetchEmailSummary,
  fetchEmailThread,
} from "@/features/inbox/queries";
import { createTask } from "@/features/tasks/mutations";
import type { EmailAction } from "@/features/inbox/types";
import {
  ArrowLeftIcon,
  CaretDownIcon,
  CaretUpIcon,
  PaperclipIcon,
} from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import {
  useCallback,
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
import { QuickReply, type QuickReplyHandle } from "./quick-reply";
import { MessageBody, ThreadMessageCard } from "./thread-message-card";

const ATTACHMENT_SKELETON_KEYS = ["attachment-a", "attachment-b"] as const;
const detailRoute = getRouteApi("/_dashboard/inbox/$id/email/$emailId");

function getSnoozeTimestamp(action: EmailAction) {
  if (action.type !== "snooze") return null;
  const until = action.payload.until;
  if (typeof until !== "string" || until.trim().length === 0) return null;
  const timestamp = new Date(until).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

function isSupportedAiAction(action: EmailAction) {
  if (action.status !== "pending") return false;
  if (action.type === "archive") return true;
  if (action.type === "snooze") return getSnoozeTimestamp(action) != null;
  if (
    action.type === "reply" &&
    typeof action.payload.draft === "string" &&
    action.payload.draft.trim()
  )
    return true;
  if (
    action.type === "create_task" &&
    typeof action.payload.taskTitle === "string" &&
    action.payload.taskTitle.trim()
  )
    return true;
  return false;
}

function getAiActionButtonLabel(action: EmailAction) {
  if (action.type === "archive") return "Archive";
  if (action.type === "snooze") return "Snooze";
  if (action.type === "reply") return "Use suggested reply";
  if (action.type === "create_task") return "Create task";
  return action.label;
}

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
  const supportedAiActions = useMemo(
    () => intelligence?.actions.filter(isSupportedAiAction) ?? [],
    [intelligence],
  );

  const summaryQuery = useQuery({
    queryKey: ["email-ai-summary", email.id],
    queryFn: () => fetchEmailSummary(email.id),
    enabled: intelligence != null && !intelligence.summary,
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
  });
  const summary = intelligence?.summary || summaryQuery.data || null;
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
    email.hasAttachment || email.attachments.length > 0;
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

  const handleAiAction = useCallback(
    (action: EmailAction) => {
      if (action.type === "reply") {
        const draft = typeof action.payload.draft === "string"
          ? action.payload.draft
          : undefined;
        quickReplyRef.current?.scrollIntoViewAndFocus(draft);
        return;
      }
      aiActionMutation.mutate(action);
    },
    [quickReplyRef],
  );

  const aiActionMutation = useMutation({
    mutationFn: async (action: EmailAction) => {
      if (action.type === "archive") {
        await patchEmail(email.id, { archived: true });
        return action;
      }

      if (action.type === "snooze") {
        const snoozedUntil = getSnoozeTimestamp(action);
        if (snoozedUntil == null) {
          throw new Error("Missing snooze time");
        }
        await patchEmail(email.id, { snoozedUntil });
        return action;
      }

      if (action.type === "create_task") {
        const title = typeof action.payload.taskTitle === "string"
          ? action.payload.taskTitle.trim()
          : "";
        if (!title) throw new Error("Missing task title");
        await createTask({ title });
        return action;
      }

      throw new Error("Unsupported AI action");
    },
    onSuccess: async (action) => {
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

      if (action.type === "archive") {
        toast.success("Archived");
        onClose?.();
        return;
      }

      if (action.type === "create_task") {
        queryClient.invalidateQueries({ queryKey: ["tasks"] });
        toast.success("Task created");
        return;
      }

      toast.success("Snoozed");
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to apply AI action",
      );
    },
  });

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
        <div className="space-y-4">
          {intelligence && (
            <section className="space-y-4 rounded-md border border-border/50 p-2">
              <div className="tracking-[-0.6px] text-sm text-foreground font-medium">
                Overview
              </div>
              {summary && (
                <p className="text-xs tracking-[-0.2px]">
                  {summary}
                </p>
              )}
              {!summary && summaryQuery.isFetching && (
                <p className="text-xs tracking-[-0.2px] animate-pulse text-muted-foreground">
                  Summarizing...
                </p>
              )}
              {supportedAiActions.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {supportedAiActions.map((action) => (
                    <Button
                      key={action.id}
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={aiActionMutation.isPending}
                      onClick={() => handleAiAction(action)}
                    >
                      {getAiActionButtonLabel(action)}
                    </Button>
                  ))}
                </div>
              )}
              {supportedAiActions.some(
                (a) => a.type === "reply" && a.payload.draft,
              ) && (
                <p className="line-clamp-3 text-xs leading-5 text-muted-foreground">
                  {String(
                    supportedAiActions.find((a) => a.type === "reply")?.payload
                      .draft ?? "",
                  )}
                </p>
              )}
              {intelligence.calendarEvents.some(
                (event) => event.status === "pending",
              ) && (
                <div className="space-y-2 border-t border-border/70 pt-3">
                  {intelligence.calendarEvents
                    .filter((event) => event.status === "pending")
                    .map((event) => (
                      <div
                        key={event.id}
                        className="text-xs text-muted-foreground"
                      >
                        <span className="font-medium text-foreground">
                          {event.title}
                        </span>
                        {" · "}
                        {event.isAllDay
                          ? new Date(event.startAt).toLocaleDateString()
                          : new Date(event.startAt).toLocaleString()}
                      </div>
                    ))}
                </div>
              )}
            </section>
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
                      detail={isSelectedMessage ? email : null}
                      active={isSelectedMessage}
                      expanded={isExpanded}
                      onToggle={() => toggleThreadMessage(threadEmail.id)}
                      showAttachments={
                        isSelectedMessage && hasSelectedAttachments
                      }
                      attachmentLoading={false}
                      attachmentError={false}
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
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {ATTACHMENT_SKELETON_KEYS.map((key) => (
                        <Skeleton key={key} className="h-16 rounded-2xl" />
                      ))}
                    </div>
                  )}
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
