import { cn } from "@/lib/utils";
import { XIcon } from "@phosphor-icons/react";
import type { AttachmentFile } from "../hooks/use-attachment-upload";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type AttachmentBarProps = {
  files: AttachmentFile[];
  uploading: boolean;
  onAddFiles: (files: FileList) => void;
  onRemoveFile: (key: string) => void;
};

export function AttachmentBar({
  files,
  uploading,
  onRemoveFile,
}: AttachmentBarProps) {
  if (files.length === 0 && !uploading) return null;

  return (
    <div className={cn("mb-2 flex flex-wrap items-center gap-2", uploading && "animate-pulse")}>
      {files.map((file) => (
        <span
          key={file.key}
          className="inline-flex items-center gap-1 rounded-md border border-border/70 p-1 text-[10px] text-muted-foreground"
        >
          {file.filename}
          <span className="text-muted-foreground/80">
            ({formatSize(file.size)})
          </span>
          <button
            type="button"
            onClick={() => onRemoveFile(file.key)}
            className="ml-0.5 text-muted-foreground transition-colors hover:text-foreground"
          >
            <XIcon className="size-3" />
          </button>
        </span>
      ))}
    </div>
  );
}
