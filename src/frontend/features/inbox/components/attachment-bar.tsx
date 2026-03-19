import { Button } from "@/components/ui/button";
import { PaperclipIcon, XIcon } from "@phosphor-icons/react";
import { useRef } from "react";
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
  onAddFiles,
  onRemoveFile,
}: AttachmentBarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 gap-1.5 text-xs"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
      >
        <PaperclipIcon className="size-3.5" />
        {uploading ? "Uploading..." : "Attach"}
      </Button>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            onAddFiles(e.target.files);
            e.target.value = "";
          }
        }}
      />
      {files.map((file) => (
        <span
          key={file.key}
          className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/40 px-2 py-0.5 text-xs"
        >
          {file.filename}
          <span className="text-muted-foreground">
            ({formatSize(file.size)})
          </span>
          <button
            type="button"
            onClick={() => onRemoveFile(file.key)}
            className="ml-0.5 text-muted-foreground hover:text-foreground"
          >
            <XIcon className="size-3" />
          </button>
        </span>
      ))}
    </div>
  );
}
