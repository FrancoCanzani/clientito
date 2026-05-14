import { Button } from "@/components/ui/button";
import { FileIcon, WarningCircleIcon } from "@phosphor-icons/react";
import type { EmailAttachment } from "../types";
import type { AttachmentPreview } from "./attachment-preview-utils";
import { ImagePreview } from "./image-preview";
import { PdfPreview } from "./pdf-preview";

type AttachmentPreviewDisplayProps = {
  attachment: EmailAttachment;
  preview: AttachmentPreview;
  isMobile: boolean;
  onDownload: () => void;
};

export function AttachmentPreviewDisplay({
  attachment,
  preview,
  isMobile,
  onDownload,
}: AttachmentPreviewDisplayProps) {
  if (preview.kind === "image" && preview.url) {
    return (
      <ImagePreview
        src={preview.url}
        alt={attachment.filename || "Image attachment"}
      />
    );
  }

  if (preview.kind === "pdf" && preview.url) {
    return (
      <PdfPreview
        src={preview.url}
        title={attachment.filename || "PDF attachment"}
        isMobile={isMobile}
        onDownload={onDownload}
      />
    );
  }

  return (
    <div className="flex h-full min-h-60 flex-col items-center justify-center gap-3 bg-background px-6 text-center">
      <div className="flex size-10 items-center justify-center border border-border/70 bg-muted/30 text-muted-foreground">
        {preview.kind === "unsupported" ? (
          <FileIcon className="size-5" />
        ) : (
          <WarningCircleIcon className="size-5" />
        )}
      </div>
      <div className="space-y-1">
        <p className="text-xs font-medium text-foreground">
          No preview available
        </p>
        <p className="max-w-xs text-xs text-muted-foreground">
          This file type can still be downloaded.
        </p>
      </div>
      <Button type="button" variant="secondary" size="sm" onClick={onDownload}>
        Download
      </Button>
    </div>
  );
}
