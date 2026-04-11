import type { EmailDetailItem, EmailThreadItem } from "@/features/email/inbox/types";
import { forwardRef, useImperativeHandle, useRef } from "react";
import type { ComposeInitial } from "../../types";
import { EmailDetailHeader } from "./email-detail-header";
import { EmailIntelligence } from "./email-intelligence";
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

  useImperativeHandle(ref, () => ({
    triggerReply: (draft?: string) =>
      quickReplyRef.current?.scrollIntoViewAndFocus(draft),
  }));

  return (
    <div className="flex w-full min-w-0 flex-col space-y-8">
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
      />

      <div className="w-full space-y-8">
        <EmailIntelligence
          email={email}
          onReplyRequested={(draft) =>
            quickReplyRef.current?.scrollIntoViewAndFocus(draft)
          }
        />
        <EmailThread
          email={email}
          threadMessages={threadMessages}
          threadError={threadError}
        />
        <QuickReply ref={quickReplyRef} email={email} detail={email} />
      </div>
    </div>
  );
});
