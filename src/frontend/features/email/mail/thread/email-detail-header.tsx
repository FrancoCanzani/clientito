import { IconButton } from "@/components/ui/icon-button";
import type { useMailActions } from "@/features/email/mail/shared/hooks/use-mail-actions";
import type { EmailDetailItem } from "@/features/email/mail/shared/types";
import { shortcutKey } from "@/lib/shortcuts";
import { cn } from "@/lib/utils";
import {
  ArrowLeftIcon,
  CaretDownIcon,
  CaretUpIcon,
} from "@phosphor-icons/react";
import type { ComposeInitial } from "@/features/email/mail/shared/types";
import { EmailActions } from "@/features/email/mail/list/email-actions";

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
  isScrolled?: boolean;
}) {
 return (
 <div
 data-print-hide
 className={cn(
 "flex min-h-10 shrink-0 items-center justify-between gap-3 border-b bg-background px-3 py-1.5 md:px-4",
 isScrolled ? "border-border/40" : "border-transparent",
 )}
 >
 <div className="flex w-full items-center justify-between gap-2">
 <div className="flex items-center gap-0.5">
 <IconButton
 label="Back"
  shortcut={shortcutKey("action:esc")}
 variant="ghost"
 size="icon-sm"
 onClick={() => onBack?.()}
 >
 <ArrowLeftIcon className="size-3.5" />
 </IconButton>
 <div className="hidden items-center gap-0.5 md:flex">
 <IconButton
 label="Previous"
  shortcut={shortcutKey("detail:prev")}
 variant="ghost"
 size="icon-sm"
 onClick={() => onPrev?.()}
 disabled={!hasPrev}
 >
 <CaretUpIcon className="size-3.5" />
 </IconButton>
 <IconButton
 label="Next"
  shortcut={shortcutKey("detail:next")}
 variant="ghost"
 size="icon-sm"
 onClick={() => onNext?.()}
 disabled={!hasNext}
 >
 <CaretDownIcon className="size-3.5" />
 </IconButton>
 </div>
 </div>

<EmailActions
  email={email}
  onClose={onClose}
  onForward={onForward}
  onAction={onAction}
  onReply={onReply}
/>
 </div>
 </div>
 );
}
