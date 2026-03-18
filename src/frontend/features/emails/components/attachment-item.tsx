import { Button } from "@/components/ui/button";
import {
  ArrowClockwiseIcon,
  DownloadSimpleIcon,
  ImageIcon,
  PaperclipIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";
import { useState } from "react";
import type { EmailAttachment } from "../types";
import { formatBytes } from "../utils/format-bytes";

async function downloadAttachment(attachment: EmailAttachment) {
  const response = await fetch(attachment.downloadUrl);
  if (!response.ok) {
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      throw new Error(payload.error ?? "Download failed");
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

export function AttachmentItem({
  attachment,
}: {
  attachment: EmailAttachment;
}) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

  return (
    <div className="rounded-xl border border-border/60 bg-card/30 px-3 py-2.5 text-xs">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex items-center gap-2">
          {attachment.isImage ? (
            <ImageIcon className="size-4 text-muted-foreground" />
          ) : (
            <PaperclipIcon className="size-4 text-muted-foreground" />
          )}
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
          size="icon"
          variant="ghost"
          className="size-8 shrink-0"
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
            <ArrowClockwiseIcon className="size-4" />
          ) : (
            <DownloadSimpleIcon className="size-4" />
          )}
        </Button>
      </div>

      {errorMessage && (
        <div className="mt-2 flex items-center justify-between gap-2 rounded-lg border border-destructive/20 bg-destructive/10 px-2.5 py-2 text-destructive">
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
  );
}
