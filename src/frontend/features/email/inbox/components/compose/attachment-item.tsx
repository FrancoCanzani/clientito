import { Button } from "@/components/ui/button";
import {
  ArrowClockwiseIcon,
  ArrowsOutIcon,
  DownloadSimpleIcon,
  ImageIcon,
  PaperclipIcon,
  WarningCircleIcon,
  XIcon,
} from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import type { EmailAttachment } from "../../types";
import { formatBytes } from "../../utils/formatters";

function getPayloadError(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) return null;
  const error = Reflect.get(payload, "error");
  return typeof error === "string" ? error : null;
}

async function downloadAttachment(attachment: EmailAttachment) {
  const response = await fetch(attachment.downloadUrl);
  if (!response.ok) {
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(getPayloadError(payload) ?? "Download failed");
    }

    throw new Error("Download failed");
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = attachment.filename || "attachment";
  link.rel = "noreferrer";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1_000);
}

function ImageLightbox({
  src,
  alt,
  onClose,
}: {
  src: string;
  alt: string;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      tabIndex={-1}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <button
        type="button"
        className="absolute right-4 top-4 flex size-9 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
        onClick={onClose}
        aria-label="Close preview"
      >
        <XIcon className="size-5" />
      </button>
      <img
        src={src}
        alt={alt}
        className="max-h-[85vh] max-w-[90vw] rounded-lg object-contain"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

export function AttachmentItem({
  attachment,
}: {
  attachment: EmailAttachment;
}) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const handleDownload = async () => {
    setIsDownloading(true);
    setErrorMessage(null);

    try {
      await downloadAttachment(attachment);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to download attachment",
      );
    } finally {
      setIsDownloading(false);
    }
  };

  const previewUrl = attachment.isImage
    ? (attachment.inlineUrl ?? attachment.downloadUrl)
    : null;

  return (
    <>
      <div className="border-b border-border/70 py-3 text-xs last:border-b-0">
        {previewUrl && (
          <button
            type="button"
            className="group relative mb-3 block w-full overflow-hidden rounded-lg bg-muted/30"
            onClick={() => setLightboxOpen(true)}
          >
            <img
              src={previewUrl}
              alt={attachment.filename || "Image attachment"}
              className="h-40 w-full object-cover transition-transform duration-150 group-hover:scale-[1.02]"
              loading="lazy"
            />
            <span className="absolute bottom-2 right-2 flex size-7 items-center justify-center rounded-full bg-black/50 text-white opacity-0 transition-opacity group-hover:opacity-100">
              <ArrowsOutIcon className="size-3.5" />
            </span>
          </button>
        )}

        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex items-center gap-2">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted/45">
              {attachment.isImage ? (
                <ImageIcon className="size-3 text-muted-foreground" />
              ) : (
                <PaperclipIcon className="size-3 text-muted-foreground" />
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {attachment.filename || "Untitled attachment"}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {formatBytes(attachment.size)}
                {attachment.mimeType ? ` · ${attachment.mimeType}` : ""}
              </p>
            </div>
          </div>

          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            className="size-8 shrink-0 text-muted-foreground"
            onClick={(event) => {
              event.stopPropagation();
              handleDownload();
            }}
            disabled={isDownloading}
            aria-label={
              errorMessage ? "Retry attachment download" : "Download attachment"
            }
          >
            {errorMessage ? (
              <ArrowClockwiseIcon className="size-4" />
            ) : (
              <DownloadSimpleIcon className="size-4" />
            )}
          </Button>
        </div>

        {errorMessage && (
          <div className="mt-3 flex items-center justify-between gap-2 border-l border-destructive/40 pl-3 text-destructive">
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
                handleDownload();
              }}
              disabled={isDownloading}
            >
              Retry
            </Button>
          </div>
        )}
      </div>

      {lightboxOpen && previewUrl && (
        <ImageLightbox
          src={previewUrl}
          alt={attachment.filename || "Image attachment"}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </>
  );
}
