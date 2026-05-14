import { useMailCompose } from "@/features/email/mail/compose/compose-context";
import type { useMailActions } from "@/features/email/mail/hooks/use-mail-actions";
import type {
  EmailDetailItem,
  EmailThreadItem,
} from "@/features/email/mail/types";
import { buildReplyInitial } from "@/features/email/mail/utils/reply-compose";
import { useIsScrolled } from "@/hooks/use-is-scrolled";
import { cn } from "@/lib/utils";
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

  useImperativeHandle(ref, () => ({
    triggerReply: (draft?: string) =>
      quickReplyRef.current?.scrollIntoViewAndFocus(draft),
  }));

  const handleReplyToMessage = (message: EmailThreadItem) => {
    openCompose(buildReplyInitial(message, message));
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
            threadMessages={threadMessages}
            threadError={threadError}
            onReplyToMessage={handleReplyToMessage}
          />
          <div data-print-hide>
            <QuickReply
              ref={quickReplyRef}
              email={email}
              detail={email}
              threadMessages={threadMessages}
            />
          </div>
        </div>
      </div>
    </div>
  );
});
