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
  readingMode,
  onReadingModeChange,
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
  readingMode: "original" | "detox";
  onReadingModeChange: (mode: "original" | "detox") => void;
}) {
  return (
    <div className="sticky top-0 z-20 flex min-h-14 w-full shrink-0 items-center border-b border-border/60 bg-background/80 px-4 backdrop-blur-xl">
      <div className="flex w-full items-center justify-between gap-2">
        <div className="flex items-center gap-0.5">
          <SidebarTrigger className="md:hidden" />
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

        <div className="flex items-center gap-1">
          <div className="flex items-center rounded-md border border-border/60 bg-muted/50 p-0.5 text-xs">
            <button
              type="button"
              className={`rounded-sm px-2 py-0.5 font-medium transition-colors ${
                readingMode === "original"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => onReadingModeChange("original")}
            >
              Original
            </button>
            <button
              type="button"
              className={`rounded-sm px-2 py-0.5 font-medium transition-colors ${
                readingMode === "detox"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => onReadingModeChange("detox")}
            >
              Simplified
            </button>
          </div>
          <EmailActions
            email={email}
            onClose={onClose}
            onForward={onForward}
            onReply={onReply}
          />
        </div>
      </div>
    </div>
  );
}
