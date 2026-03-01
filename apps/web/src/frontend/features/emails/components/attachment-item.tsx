import { DownloadSimpleIcon, ImageIcon, PaperclipIcon } from "@phosphor-icons/react";
import type { EmailAttachment } from "../types";
import { formatBytes } from "../utils/format-bytes";

export function AttachmentItem({ attachment }: { attachment: EmailAttachment }) {
  return (
    <a
      href={attachment.downloadUrl}
      target="_blank"
      rel="noreferrer"
      className="group flex items-center justify-between gap-3 rounded-md bg-card/30 px-3 py-2 text-xs hover:bg-accent/40"
    >
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
      <DownloadSimpleIcon className="size-4 shrink-0 text-muted-foreground group-hover:text-foreground" />
    </a>
  );
}
