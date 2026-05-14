import { Button } from "@/components/ui/button";
import {
  ArrowClockwiseIcon,
  DownloadSimpleIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";
import { useState } from "react";
import { AttachmentPreviewDialog } from "../attachments/attachment-preview-dialog";
import {
  downloadEmailAttachment,
  getAttachmentBadgeClass,
  getAttachmentLabel,
} from "../attachments/attachment-preview-utils";
import type { EmailAttachment } from "../types";
import { formatBytes } from "../utils/formatters";

export function AttachmentItem({
  attachment,
  previewAttachments,
  previewIndex,
}: {
  attachment: EmailAttachment;
  previewAttachments?: EmailAttachment[];
  previewIndex?: number;
}) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadingAttachmentId, setDownloadingAttachmentId] = useState<
    string | null
  >(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const attachmentsForPreview = previewAttachments ?? [attachment];
  const currentPreviewIndex = previewIndex ?? 0;
  const fileLabel = getAttachmentLabel(attachment);
  const fileBadgeClass = getAttachmentBadgeClass(attachment);

  const handleDownload = async (targetAttachment = attachment) => {
    setIsDownloading(true);
    setDownloadingAttachmentId(targetAttachment.attachmentId);
    setErrorMessage(null);

    try {
      await downloadEmailAttachment(targetAttachment);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to download attachment",
      );
    } finally {
      setIsDownloading(false);
      setDownloadingAttachmentId(null);
    }
  };

  const openPreview = () => {
    setPreviewOpen(true);
  };

  return (
    <>
      <div className="space-y-1">
        <div className="group/chip inline-flex min-h-8 w-full max-w-full items-center overflow-hidden bg-muted/50 text-xs transition-colors hover:bg-muted/80 focus-within:bg-muted/80 sm:w-[min(300px,100%)]">
          <button
            type="button"
            className="flex min-w-0 flex-1 items-center gap-2 px-1.5 py-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
            onClick={openPreview}
            aria-label="Preview attachment"
          >
            <span
              className={`inline-flex min-h-5 shrink-0 items-center px-1.5 text-[10px] font-medium leading-4 ${fileBadgeClass}`}
            >
              {fileLabel}
            </span>
            <span className="min-w-0 truncate text-xs font-medium leading-4 text-foreground">
              {attachment.filename || "Untitled attachment"}
            </span>
            <span className="shrink-0 font-mono text-[11px] leading-4 text-muted-foreground">
              {formatBytes(attachment.size)}
            </span>
          </button>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            className="mr-1 size-6 shrink-0 text-muted-foreground hover:bg-transparent hover:text-foreground"
            onClick={(event) => {
              event.stopPropagation();
              void handleDownload();
            }}
            disabled={isDownloading}
            aria-label={
              errorMessage ? "Retry attachment download" : "Download attachment"
            }
          >
            {errorMessage ? (
              <ArrowClockwiseIcon className="size-3.5" />
            ) : (
              <DownloadSimpleIcon className="size-3.5" />
            )}
          </Button>
        </div>

        {errorMessage && (
          <div className="flex max-w-full items-center justify-between gap-2 border-l border-destructive/40 pl-3 text-xs text-destructive sm:w-[min(326px,100%)]">
            <div className="flex min-w-0 items-center gap-2">
              <WarningCircleIcon className="size-4 shrink-0" />
              <p className="truncate">{errorMessage}</p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-destructive"
              onClick={(event) => {
                event.stopPropagation();
                void handleDownload();
              }}
              disabled={isDownloading}
            >
              Retry
            </Button>
          </div>
        )}
      </div>

      <AttachmentPreviewDialog
        attachments={attachmentsForPreview}
        initialIndex={currentPreviewIndex}
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        onDownload={(targetAttachment) => {
          void handleDownload(targetAttachment);
        }}
        downloadingAttachmentId={downloadingAttachmentId}
      />
    </>
  );
}
