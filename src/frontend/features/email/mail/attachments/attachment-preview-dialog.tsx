import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import {
  CaretLeftIcon,
  CaretRightIcon,
  DownloadSimpleIcon,
  XIcon,
} from "@phosphor-icons/react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { EmailAttachment } from "../types";
import { formatBytes } from "../utils/formatters";
import { AttachmentPreviewDisplay } from "./attachment-preview-display";
import { getAttachmentPreview } from "./attachment-preview-utils";

type AttachmentPreviewDialogProps = {
  attachments: EmailAttachment[];
  initialIndex: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDownload: (attachment: EmailAttachment) => void;
  downloadingAttachmentId: string | null;
};

export function AttachmentPreviewDialog({
  attachments,
  initialIndex,
  open,
  onOpenChange,
  onDownload,
  downloadingAttachmentId,
}: AttachmentPreviewDialogProps) {
  const isMobile = useIsMobile();
  const dialogRef = useRef<HTMLDivElement>(null);
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  useEffect(() => {
    if (open) setCurrentIndex(initialIndex);
  }, [initialIndex, open]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  const currentAttachment = attachments[currentIndex];
  const preview = useMemo(
    () =>
      currentAttachment
        ? getAttachmentPreview(currentAttachment)
        : { kind: "unsupported" as const, url: null },
    [currentAttachment],
  );

  if (!open || !currentAttachment) return null;

  const hasPrevious = currentIndex > 0;
  const hasNext = currentIndex < attachments.length - 1;
  const close = () => onOpenChange(false);
  const showNavigation = attachments.length > 1 && !isMobile;
  const isDownloading =
    downloadingAttachmentId === currentAttachment.attachmentId;

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={currentAttachment.filename || "Attachment preview"}
      tabIndex={-1}
      className="fixed inset-0 z-50 bg-[oklch(12%_0.01_250)]/80 text-foreground"
      onKeyDown={(event) => {
        if (event.key === "Escape") close();
        if (event.key === "ArrowLeft" && hasPrevious) {
          event.preventDefault();
          setCurrentIndex((index) => index - 1);
        }
        if (event.key === "ArrowRight" && hasNext) {
          event.preventDefault();
          setCurrentIndex((index) => index + 1);
        }
      }}
    >
      <div
        className={cn(
          "flex h-dvh w-dvw flex-col bg-background shadow-2xl sm:absolute sm:left-1/2 sm:top-1/2 sm:h-[84vh] sm:w-[min(92vw,1080px)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:border sm:border-border/50",
          isMobile && "pt-[env(safe-area-inset-top)]",
        )}
      >
        <div className="flex min-h-12 items-center gap-2 border-b border-border/60 bg-background/95 px-2 sm:px-3">
          <Button
            type="button"
            variant="ghost"
            size="icon-lg"
            onClick={close}
            aria-label="Close preview"
          >
            <XIcon className="size-4" />
          </Button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium">
              {currentAttachment.filename || "Untitled attachment"}
            </p>
            <p className="truncate font-mono text-[10px] text-muted-foreground">
              {formatBytes(currentAttachment.size)}
            </p>
          </div>
          {showNavigation && (
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => setCurrentIndex((index) => index - 1)}
                disabled={!hasPrevious}
                aria-label="Previous attachment"
              >
                <CaretLeftIcon className="size-3.5" />
              </Button>
              <p className="w-12 text-center font-mono text-[10px] text-muted-foreground">
                {currentIndex + 1}/{attachments.length}
              </p>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => setCurrentIndex((index) => index + 1)}
                disabled={!hasNext}
                aria-label="Next attachment"
              >
                <CaretRightIcon className="size-3.5" />
              </Button>
            </div>
          )}
          <Button
            type="button"
            variant="ghost"
            size={isMobile ? "icon-lg" : "icon-sm"}
            onClick={() => onDownload(currentAttachment)}
            disabled={isDownloading}
            aria-label="Download attachment"
          >
            <DownloadSimpleIcon className="size-4" />
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden bg-background">
          <AttachmentPreviewDisplay
            attachment={currentAttachment}
            preview={preview}
            isMobile={isMobile}
            onDownload={() => onDownload(currentAttachment)}
          />
        </div>
      </div>
    </div>
  );
}
