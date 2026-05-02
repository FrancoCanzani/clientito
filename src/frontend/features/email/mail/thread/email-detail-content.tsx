import type { EmailDetailItem, EmailThreadItem } from "@/features/email/mail/types";
import { useIsScrolled } from "@/hooks/use-is-scrolled";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { ComposeInitial } from "../types";
import { EmailDetailHeader } from "./email-detail-header";
import { EmailThread } from "./email-thread";
import { QuickReply, type QuickReplyHandle } from "./quick-reply";

const READING_MODE_STORAGE_KEY = "petit:reading-mode";

function readStoredReadingMode(): "original" | "detox" {
  if (typeof window === "undefined") return "detox";
  const stored = window.localStorage.getItem(READING_MODE_STORAGE_KEY);
  return stored === "original" ? "original" : "detox";
}

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
  const [readingMode, setReadingMode] = useState<"original" | "detox">(
    readStoredReadingMode,
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(READING_MODE_STORAGE_KEY, readingMode);
  }, [readingMode]);

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
          readingMode={readingMode}
          onReadingModeChange={setReadingMode}
          isScrolled={isScrolled}
        />

        <div className="w-full space-y-6 px-3 pt-3 pb-24 md:px-6">
          <EmailThread
            email={email}
            threadMessages={threadMessages}
            threadError={threadError}
            readingMode={readingMode}
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
