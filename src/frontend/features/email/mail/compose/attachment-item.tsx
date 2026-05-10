import { Button } from "@/components/ui/button";
import {
  ArrowClockwiseIcon,
  DownloadSimpleIcon,
  ImageIcon,
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

function isDocumentAttachment(attachment: EmailAttachment): boolean {
  const mimeType = attachment.mimeType?.toLowerCase() ?? "";
  const filename = attachment.filename?.toLowerCase() ?? "";
  const extension = filename.split(".").pop() ?? "";
  return (
    mimeType.includes("word") ||
    mimeType.includes("document") ||
    ["doc", "docx", "rtf", "odt"].includes(extension)
  );
}

function getFileExtension(filename: string | null): string {
  const extension = filename?.split(".").pop()?.trim();
  if (!extension || extension === filename) return "FILE";
  return extension.slice(0, 4).toUpperCase();
}

function getFileBadgeClass(attachment: EmailAttachment): string {
  if (isPdfAttachment(attachment)) return "bg-red-500 text-white";
  if (isDocumentAttachment(attachment)) {
    return "bg-blue-500 text-white";
  }

  return "bg-muted text-muted-foreground";
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
        className="absolute right-4 top-4 flex size-9 items-center justify-center bg-white/10 text-white transition-colors hover:bg-white/20"
        onClick={onClose}
        aria-label="Close preview"
      >
        <XIcon className="size-5" />
      </button>
      <img
        src={src}
        alt={alt}
        className="max-h-[85vh] max-w-[90vw] object-contain"
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
        className="absolute right-4 top-4 z-10 flex size-9 items-center justify-center bg-white/10 text-white transition-colors hover:bg-white/20"
        onClick={onClose}
        aria-label="Close preview"
      >
        <XIcon className="size-5" />
      </button>

      <div
        className="h-[88vh] w-[92vw] max-w-6xl overflow-hidden bg-background shadow-2xl"
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
  const hasDocumentThumbnail = isDocumentAttachment(attachment);
  const fileLabel = pdfPreviewUrl
    ? "PDF"
    : getFileExtension(attachment.filename);
  const fileBadgeClass = getFileBadgeClass(attachment);
  const previewType =
    imagePreviewUrl && !imagePreviewFailed
      ? "image"
      : pdfPreviewUrl
        ? "pdf"
        : null;
  const openPreview = () => {
    if (previewType) setPreviewOpen(previewType);
  };

  return (
    <>
      <div
        className={`group/attachment relative aspect-[1.65] overflow-hidden border border-border/50 bg-background text-sm transition-colors hover:border-border ${previewType ? "cursor-pointer" : ""}`}
        onClick={openPreview}
        onKeyDown={(event) => {
          if (!previewType) return;
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openPreview();
          }
        }}
        role={previewType ? "button" : undefined}
        tabIndex={previewType ? 0 : undefined}
        aria-disabled={previewType ? undefined : true}
        aria-label={previewType ? "Preview attachment" : undefined}
      >
        <div
          className="absolute inset-0 flex size-full items-center justify-center overflow-hidden bg-muted/25 text-muted-foreground"
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
          ) : pdfPreviewUrl || hasDocumentThumbnail ? (
            <div className="flex h-full w-full flex-col justify-center gap-3 bg-card px-4 py-3 text-left">
              <div className="h-1.5 w-16 bg-muted" />
              <div className="space-y-1.5">
                <div className="h-1 w-24 bg-muted-foreground/20" />
                <div className="h-1 w-20 bg-muted-foreground/20" />
                <div className="h-1 w-28 bg-muted-foreground/20" />
              </div>
            </div>
          ) : attachment.isImage ? (
            <ImageIcon className="size-7" />
          ) : (
            <div className="size-full" />
          )}
        </div>

        <div className="absolute inset-x-0 bottom-0 z-10 max-h-10 overflow-hidden border-t border-border/40 bg-background/95 px-2 py-1.5 transition-[max-height,padding] duration-150 group-hover/attachment:max-h-full group-hover/attachment:pb-3 group-hover/attachment:pt-2">
          <div className="flex min-w-0 items-center group-hover/attachment:items-start gap-1.5">
            <span
              className={`mt-0.5 inline-flex h-4 shrink-0 items-center px-1 text-[9px] font-semibold leading-none ${fileBadgeClass}`}
            >
              {fileLabel}
            </span>
            <p className="min-w-0 truncate text-xs font-medium leading-4 group-hover/attachment:whitespace-normal group-hover/attachment:break-all group-hover/attachment:text-clip">
              {attachment.filename || "Untitled attachment"}
            </p>
          </div>

          <div className="grid max-h-0 grid-cols-[minmax(0,1fr)_auto] items-end gap-2 overflow-hidden opacity-0 transition-[max-height,opacity,padding] duration-150 group-hover/attachment:max-h-8 group-hover/attachment:pt-2 group-hover/attachment:opacity-100">
            <p className="min-w-0 truncate text-[11px] leading-3 text-muted-foreground">
              {formatBytes(attachment.size)}
            </p>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              className="-mb-1 -mr-1 size-7 shrink-0 text-muted-foreground hover:text-foreground"
              onClick={(event) => {
                event.stopPropagation();
                handleDownload();
              }}
              disabled={isDownloading}
              aria-label={
                errorMessage
                  ? "Retry attachment download"
                  : "Download attachment"
              }
            >
              {errorMessage ? (
                <ArrowClockwiseIcon className="size-3.5" />
              ) : (
                <DownloadSimpleIcon className="size-3.5" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {errorMessage && (
        <div className="flex items-center justify-between gap-2 border-l border-destructive/40 pl-3 text-xs text-destructive">
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
        <div className="flex items-center gap-2 border-l border-border/70 pl-3 text-xs text-muted-foreground">
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
