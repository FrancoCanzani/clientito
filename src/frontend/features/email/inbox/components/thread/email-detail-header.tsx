import { IconButton } from "@/components/ui/icon-button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import type { EmailDetailItem } from "@/features/email/inbox/types";
import { cn } from "@/lib/utils";
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
  onReply: () => void;
  readingMode: "original" | "detox";
  onReadingModeChange: (mode: "original" | "detox") => void;
  isScrolled?: boolean;
}) {
  return (
    <div
      className={cn(
        "sticky top-0 z-20 flex min-h-14 shrink-0 items-center justify-between gap-3 border-b px-4 transition-colors duration-300 sm:px-6",
        isScrolled ? "border-border/40 liquid-glass" : "border-transparent",
      )}
    >
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
          <div className="flex items-center rounded-md border border-border/40 bg-muted/50 p-0.5 text-xs">
            <button
              type="button"
              className={`rounded-md px-2 py-0.5 transition-colors ${
                readingMode === "original"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => onReadingModeChange("original")}
            >
              Original
            </button>
            <button
              type="button"
              className={`rounded-md px-2 py-0.5 transition-colors ${
                readingMode === "detox"
                  ? "bg-background text-foreground shadow-xs"
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
