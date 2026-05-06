import { IconButton } from "@/components/ui/icon-button";
import type { useMailActions } from "@/features/email/mail/hooks/use-mail-actions";
import type { EmailDetailItem } from "@/features/email/mail/types";
import { cn } from "@/lib/utils";
import {
  ArrowLeftIcon,
  CaretDownIcon,
  CaretUpIcon,
} from "@phosphor-icons/react";
import type { ComposeInitial } from "../types";
import { EmailActions } from "../list/email-actions";

export function EmailDetailHeader({
  email,
  onClose,
  onBack,
  onPrev,
  onNext,
  hasPrev = false,
  hasNext = false,
  onForward,
  onAction,
  onReply,
  onDraftReply,
  isScrolled = false,
}: {
  email: EmailDetailItem;
  onClose?: () => void;
  onBack?: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
  onForward: (initial: ComposeInitial) => void;
  onAction?: ReturnType<typeof useMailActions>["executeEmailAction"];
  onReply: () => void;
  onDraftReply?: () => void;
  isScrolled?: boolean;
}) {
  return (
    <div
      className={cn(
        "sticky top-0 z-20 flex min-h-10 shrink-0 items-center justify-between gap-3 border-b bg-background px-3 py-1.5 md:px-4",
        isScrolled ? "border-border/40" : "border-transparent",
      )}
    >
      <div className="flex w-full items-center justify-between gap-2">
        <div className="flex items-center gap-0.5">
          <IconButton
            label="Back"
            shortcut="Esc"
            variant="ghost"
            size="icon-sm"
            onClick={() => onBack?.()}
          >
            <ArrowLeftIcon className="size-3.5" />
          </IconButton>
          <IconButton
            label="Previous"
            shortcut="K"
            variant="ghost"
            size="icon-sm"
            onClick={() => onPrev?.()}
            disabled={!hasPrev}
          >
            <CaretUpIcon className="size-3.5" />
          </IconButton>
          <IconButton
            label="Next"
            shortcut="J"
            variant="ghost"
            size="icon-sm"
            onClick={() => onNext?.()}
            disabled={!hasNext}
          >
            <CaretDownIcon className="size-3.5" />
          </IconButton>
        </div>

        <EmailActions
          email={email}
          onClose={onClose}
          onForward={onForward}
          onAction={onAction}
          onReply={onReply}
          onDraftReply={onDraftReply}
        />
      </div>
    </div>
  );
}
