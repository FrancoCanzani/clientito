import type { EmailDetailItem, EmailThreadItem } from "@/features/email/mail/types";
import { useIsScrolled } from "@/hooks/use-is-scrolled";
import { forwardRef, useImperativeHandle, useRef } from "react";
import type { ComposeInitial } from "../types";
import { EmailDetailHeader } from "./email-detail-header";
import { EmailThread } from "./email-thread";
import { QuickReply, type QuickReplyHandle } from "./quick-reply";

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
  },
  ref,
) {
  const quickReplyRef = useRef<QuickReplyHandle>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isScrolled = useIsScrolled(scrollRef);

  useImperativeHandle(ref, () => ({
    triggerReply: (draft?: string) =>
      quickReplyRef.current?.scrollIntoViewAndFocus(draft),
  }));

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden">
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-auto"
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
          onReply={() => quickReplyRef.current?.scrollIntoViewAndFocus()}
          onDraftReply={() => {
            const draft = email.aiDraftReply?.trim();
            quickReplyRef.current?.scrollIntoViewAndFocus(draft || undefined);
          }}
          isScrolled={isScrolled}
        />

        <div className="w-full space-y-6 px-3 pt-3 pb-24 md:px-6">
          <EmailThread
            email={email}
            threadMessages={threadMessages}
            threadError={threadError}
          />
          <QuickReply
            ref={quickReplyRef}
            email={email}
            detail={email}
            threadMessages={threadMessages}
          />
        </div>
      </div>
    </div>
  );
});
