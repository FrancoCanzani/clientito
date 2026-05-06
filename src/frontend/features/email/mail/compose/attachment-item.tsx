import { Button } from "@/components/ui/button";
import {
  ArrowClockwiseIcon,
  DownloadSimpleIcon,
  FilePdfIcon,
  ImageIcon,
  PaperclipIcon,
  WarningCircleIcon,
  XIcon,
} from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import type { EmailAttachment } from "../types";
import { formatBytes } from "../utils/formatters";

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

function toInlinePreviewUrl(url: string): string | null {
  if (!url) return null;
  try {
    const next = new URL(url, window.location.origin);
    next.searchParams.set("inline", "true");
    return `${next.pathname}${next.search}`;
  } catch {
    return null;
  }
}

function isPdfAttachment(attachment: EmailAttachment): boolean {
  const mimeType = attachment.mimeType?.toLowerCase() ?? "";
  if (mimeType === "application/pdf") return true;
  const filename = attachment.filename?.toLowerCase() ?? "";
  return filename.endsWith(".pdf");
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-[oklch(12%_0.01_250)]/80"
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

function PdfLightbox({
  src,
  title,
  onClose,
}: {
  src: string;
  title: string;
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
      aria-label={title}
      tabIndex={-1}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[oklch(12%_0.01_250)]/80 p-4"
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <button
        type="button"
        className="absolute right-4 top-4 z-10 flex size-9 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
        onClick={onClose}
        aria-label="Close preview"
      >
        <XIcon className="size-5" />
      </button>

      <div
        className="h-[88vh] w-[92vw] max-w-6xl overflow-hidden rounded-lg bg-background shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <iframe
          src={src}
          title={title}
          className="h-full w-full"
          referrerPolicy="no-referrer"
        />
      </div>
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
  const [previewOpen, setPreviewOpen] = useState<"image" | "pdf" | null>(null);
  const [imagePreviewFailed, setImagePreviewFailed] = useState(false);

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

  const inlinePreviewUrl = toInlinePreviewUrl(attachment.downloadUrl);
  const imagePreviewUrl = attachment.isImage
    ? (attachment.inlineUrl ?? inlinePreviewUrl)
    : null;
  const pdfPreviewUrl = isPdfAttachment(attachment) ? inlinePreviewUrl : null;
  const previewType = imagePreviewUrl && !imagePreviewFailed
    ? "image"
    : pdfPreviewUrl
      ? "pdf"
      : null;

  return (
    <>
      <div className="flex items-center gap-3 py-2 text-sm">
        <button
          type="button"
          onClick={() => {
            if (previewType) setPreviewOpen(previewType);
          }}
          disabled={!previewType}
          className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted/60 text-muted-foreground disabled:cursor-default"
          aria-label={previewType ? "Preview attachment" : undefined}
        >
          {imagePreviewUrl && !imagePreviewFailed ? (
            <img
              src={imagePreviewUrl}
              alt={attachment.filename || "Image attachment"}
              className="size-full object-cover"
              loading="lazy"
              onError={() => setImagePreviewFailed(true)}
            />
          ) : pdfPreviewUrl ? (
            <FilePdfIcon className="size-4" />
          ) : attachment.isImage ? (
            <ImageIcon className="size-4" />
          ) : (
            <PaperclipIcon className="size-4" />
          )}
        </button>

        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">
            {attachment.filename || "Untitled attachment"}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {formatBytes(attachment.size)}
            {attachment.mimeType ? ` · ${attachment.mimeType}` : ""}
          </p>
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
        <div className="mb-2 flex items-center justify-between gap-2 border-l border-destructive/40 pl-3 text-xs text-destructive">
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

      {imagePreviewFailed && (
        <div className="mb-2 flex items-center gap-2 border-l border-border/70 pl-3 text-xs text-muted-foreground">
          <ImageIcon className="size-4 shrink-0" />
          <p className="truncate">Preview unavailable</p>
        </div>
      )}

      {previewOpen === "image" && imagePreviewUrl && !imagePreviewFailed && (
        <ImageLightbox
          src={imagePreviewUrl}
          alt={attachment.filename || "Image attachment"}
          onClose={() => setPreviewOpen(null)}
        />
      )}

      {previewOpen === "pdf" && pdfPreviewUrl && (
        <PdfLightbox
          src={pdfPreviewUrl}
          title={attachment.filename || "PDF attachment"}
          onClose={() => setPreviewOpen(null)}
        />
      )}
    </>
  );
}
