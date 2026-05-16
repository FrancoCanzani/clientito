import { useMailCompose } from "@/features/email/mail/compose/compose-context";
import { useThreadDrafts } from "@/features/email/mail/thread/use-thread-drafts";
import type { useMailActions } from "@/features/email/mail/shared/hooks/use-mail-actions";
import type {
  EmailDetailItem,
  EmailThreadItem,
} from "@/features/email/mail/shared/types";
import { buildForwardedEmailHtml } from "@/features/email/mail/thread/build-forwarded-html";
import {
  canShowThreadSummary,
  ThreadAiPanel,
} from "@/features/email/ai/thread-ai-panel";
import { useIsScrolled } from "@/hooks/use-is-scrolled";
import { cn } from "@/lib/utils";
import { forwardRef, useImperativeHandle, useMemo, useRef } from "react";
import type { ComposeInitial } from "@/features/email/mail/shared/types";
import { EmailDetailHeader } from "@/features/email/mail/thread/email-detail-header";
import { EmailThread } from "@/features/email/mail/thread/email-thread";
import { QuickReply, type QuickReplyHandle } from "@/features/email/mail/thread/quick-reply";

export type EmailDetailContentHandle = {
  triggerReply: (draft?: string) => void;
};

export const EmailDetailContent = forwardRef<
  EmailDetailContentHandle,
  {
    email: EmailDetailItem;
    threadMessages: EmailThreadItem[];
    threadError: boolean;
    onClose?: () => void;
    onBack?: () => void;
    onPrev?: () => void;
    onNext?: () => void;
    hasPrev?: boolean;
    hasNext?: boolean;
    onForward: (initial: ComposeInitial) => void;
    onAction?: ReturnType<typeof useMailActions>["executeEmailAction"];
    embedded?: boolean;
  }
>(function EmailDetailContent(
  {
    email,
    threadMessages,
    threadError,
    onClose,
    onBack,
    onPrev,
    onNext,
    hasPrev = false,
    hasNext = false,
    onForward,
    onAction,
    embedded = false,
  },
  ref,
) {
  const quickReplyRef = useRef<QuickReplyHandle>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isScrolled = useIsScrolled(scrollRef);
  const { openCompose } = useMailCompose();
  const draftMessages = useThreadDrafts(email.threadId, email.mailboxId);

  const mergedMessages = useMemo(() => {
    if (draftMessages.length === 0) return threadMessages;
    return [...threadMessages, ...draftMessages].sort(
      (a, b) => a.date - b.date,
    );
  }, [threadMessages, draftMessages]);
  const showsThreadSummary = canShowThreadSummary({
    mailboxId: email.mailboxId,
    threadId: email.threadId,
    messages: threadMessages,
  });

  useImperativeHandle(ref, () => ({
    triggerReply: (draft?: string) =>
      quickReplyRef.current?.scrollIntoViewAndFocus({ draft }),
  }));

  const handleReplyToMessage = (message: EmailThreadItem) => {
    quickReplyRef.current?.scrollIntoViewAndFocus({
      replyTo: message,
      mode: "reply",
    });
  };

  const handleReplyAllToMessage = (message: EmailThreadItem) => {
    quickReplyRef.current?.scrollIntoViewAndFocus({
      replyTo: message,
      mode: "reply-all",
    });
  };

  const handleForwardMessage = (message: EmailThreadItem) => {
    const subject = message.subject
      ? message.subject.startsWith("Fwd:")
        ? message.subject
        : `Fwd: ${message.subject}`
      : "Fwd:";
    const bodyHtml = buildForwardedEmailHtml(message as EmailDetailItem);
    openCompose({ subject, bodyHtml });
  };

  return (
    <div
      data-print-region
      className="flex h-full min-h-0 w-full min-w-0 flex-col"
    >
      <EmailDetailHeader
        email={email}
        onClose={onClose}
        onBack={onBack}
        onPrev={onPrev}
        onNext={onNext}
        hasPrev={hasPrev}
        hasNext={hasNext}
        onForward={onForward}
        onAction={onAction}
        onReply={() => quickReplyRef.current?.scrollIntoViewAndFocus()}
        isScrolled={isScrolled}
      />

      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-auto bg-background"
      >
        <div
          className={cn(
            "w-full space-y-6 px-3 pt-3 pb-24 md:px-6",
            !embedded && "mx-auto max-w-4xl",
          )}
        >
          <EmailThread
            email={email}
            threadMessages={mergedMessages}
            threadError={threadError}
            scrollToLatestOnMount={!showsThreadSummary}
            summary={
              <div data-print-hide>
                <ThreadAiPanel
                  mailboxId={email.mailboxId}
                  threadId={email.threadId}
                  messages={threadMessages}
                  onUseDraft={(draft) =>
                    quickReplyRef.current?.scrollIntoViewAndFocus({ draft })
                  }
                />
              </div>
            }
            onReplyToMessage={handleReplyToMessage}
            onReplyAllToMessage={handleReplyAllToMessage}
            onForwardMessage={handleForwardMessage}
          />
          <div data-print-hide>
            <QuickReply
              ref={quickReplyRef}
              email={email}
              detail={email}
              threadMessages={mergedMessages}
            />
          </div>
        </div>
      </div>
    </div>
  );
});
