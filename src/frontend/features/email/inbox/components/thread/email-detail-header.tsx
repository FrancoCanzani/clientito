import { IconButton } from "@/components/ui/icon-button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import type { EmailDetailItem } from "@/features/email/inbox/types";
import {
  ArrowLeftIcon,
  CaretDownIcon,
  CaretUpIcon,
} from "@phosphor-icons/react";
import type { ComposeInitial } from "../../types";
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
  onReply,
}: {
  email: EmailDetailItem;
  onClose?: () => void;
  onBack?: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
  onForward: (initial: ComposeInitial) => void;
  onReply: () => void;
}) {
  return (
    <div className="sticky top-0 z-20 w-full bg-background pt-6 pb-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-0.5">
          <SidebarTrigger />
          <IconButton
            label="Back"
            shortcut="Esc"
            variant="ghost"
            onClick={() => onBack?.()}
          >
            <ArrowLeftIcon className="size-3.5" />
          </IconButton>
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

        <EmailActions
          email={email}
          onClose={onClose}
          onForward={onForward}
          onReply={onReply}
        />
      </div>
    </div>
  );
}
