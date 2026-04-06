import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import type {
  EmailDetailIntelligence,
  EmailDetailItem,
  EmailListItem,
  EmailThreadItem,
} from "@/features/inbox/types";
import {
  ArrowLeftIcon,
  CaretDownIcon,
  CaretUpIcon,
  PaperclipIcon,
} from "@phosphor-icons/react";
import {
  forwardRef,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ComposeInitial } from "../types";
import { formatEmailDetailDate } from "../utils/formatters";
import { AttachmentItem } from "./attachment-item";
import { EmailActionBar } from "./email-action-bar";
import { EmailAiPanel, EmailAiPanelLoading } from "./email-ai-panel";
import { MessageBody } from "./message-body";
import { QuickReply, type QuickReplyHandle } from "./quick-reply";
import { ThreadMessageCard } from "./thread-message-card";

export type EmailDetailContentHandle = {
  triggerReply: (draft?: string) => void;
};

function buildRecipientRows(email: EmailListItem) {
  return [
    {
      label: "From",
      value: email.fromName
        ? `${email.fromName} <${email.fromAddr}>`
        : email.fromAddr,
    },
    { label: "To", value: (email as EmailDetailItem).toAddr ?? "me" },
    ...((email as EmailDetailItem).ccAddr
      ? [{ label: "Cc", value: (email as EmailDetailItem).ccAddr! }]
      : []),
  ];
}

export const EmailDetailContent = forwardRef<
  EmailDetailContentHandle,
  {
    email: EmailDetailItem;
    threadMessages: EmailThreadItem[];
    threadError: boolean;
    intelligence: EmailDetailIntelligence | null;
    aiLoading: boolean;
    aiError: boolean;
    onReply: (draft?: string) => void;
    onCreateTask: (suggestion: {
      title: string;
      dueAt: number | null;
      priority: "urgent" | "high" | "medium" | "low" | null;
    }) => void;
    createTaskPending: boolean;
    onClose?: () => void;
    onBack?: () => void;
    onPrev?: () => void;
    onNext?: () => void;
    hasPrev?: boolean;
    hasNext?: boolean;
    onForward: (initial: ComposeInitial) => void;
  }
>(function EmailDetailContent(
  {
    email,
    threadMessages,
    threadError,
    intelligence,
    aiLoading,
    aiError,
    onReply,
    onCreateTask,
    createTaskPending,
    onClose,
    onBack,
    onPrev,
    onNext,
    hasPrev = false,
    hasNext = false,
    onForward,
  },
  ref,
) {
  const quickReplyRef = useRef<QuickReplyHandle>(null);
  const [threadExpansionOverrides, setThreadExpansionOverrides] = useState<
    Map<string, boolean>
  >(() => new Map());

  useImperativeHandle(ref, () => ({
    triggerReply: (draft?: string) =>
      quickReplyRef.current?.scrollIntoViewAndFocus(draft),
  }));

  const formattedDate = formatEmailDetailDate(email.date);
  const subject = email.subject ?? "(no subject)";
  const recipientRows = buildRecipientRows(email);

  const defaultExpandedIds = useMemo(() => {
    const next = new Set<string>();
    const selected = threadMessages.find((m) => m.id === email.id);
    next.add(selected ? selected.id : email.id);
    return next;
  }, [email.id, threadMessages]);

  const isExpanded = (messageId: string) =>
    threadExpansionOverrides.get(messageId) ??
    defaultExpandedIds.has(messageId);

  const toggleMessage = (messageId: string) => {
    setThreadExpansionOverrides((current) => {
      const next = new Map(current);
      next.set(messageId, !isExpanded(messageId));
      return next;
    });
  };

  const showThread = Boolean(email.threadId && threadMessages.length > 1);
  const hasAttachments = email.attachments.length > 0;

  return (
    <div className="flex w-full min-w-0 flex-col space-y-8">
      <div className="sticky top-0 z-10 w-full bg-background pt-5 pb-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-0.5">
            <SidebarTrigger className="md:hidden" />
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
          {aiLoading && !intelligence && <EmailAiPanelLoading />}

          {intelligence && (
            <EmailAiPanel
              intelligence={intelligence}
              onReply={onReply}
              onCreateTask={onCreateTask}
              createTaskPending={createTaskPending}
            />
          )}

          {aiError && !intelligence && (
            <p className="rounded-2xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              Could not load AI overview.
            </p>
          )}

          {threadError && showThread && (
            <p className="rounded-2xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              Could not load the full thread.
            </p>
          )}

          {showThread ? (
            <section className="space-y-3">
              <div className="space-y-2">
                {threadMessages.map((threadEmail) => {
                  const isSelectedMessage = threadEmail.id === email.id;

                  return (
                    <ThreadMessageCard
                      key={threadEmail.id}
                      email={threadEmail}
                      body={isSelectedMessage ? email : threadEmail}
                      expanded={isExpanded(threadEmail.id)}
                      onToggle={() => toggleMessage(threadEmail.id)}
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

              {hasAttachments && (
                <section className="mt-5 space-y-3 border-t border-border/70 pt-5">
                  <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    <PaperclipIcon className="size-3" />
                    Attachments
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {email.attachments.map((attachment) => (
                      <AttachmentItem
                        key={attachment.attachmentId}
                        attachment={attachment}
                      />
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>

        <QuickReply ref={quickReplyRef} email={email} detail={email} />
      </div>
    </div>
  );
});
