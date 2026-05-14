import { Button } from "@/components/ui/button";
import { ArrowSquareOutIcon, DownloadSimpleIcon } from "@phosphor-icons/react";
import { useEffect, useState } from "react";

type PdfPreviewProps = {
  src: string;
  title: string;
  isMobile: boolean;
  onDownload: () => void;
};

export function PdfPreview({
  src,
  title,
  isMobile,
  onDownload,
}: PdfPreviewProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );

  useEffect(() => {
    if (isMobile) {
      setStatus("ready");
      setBlobUrl(null);
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;

    async function loadPdf() {
      setStatus("loading");
      setBlobUrl(null);

      try {
        const response = await fetch(src);
        if (!response.ok) throw new Error("Failed to load PDF");
        const blob = new Blob([await response.arrayBuffer()], {
          type: "application/pdf",
        });
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setBlobUrl(objectUrl);
        setStatus("ready");
      } catch {
        if (!cancelled) setStatus("error");
      }
    }

    void loadPdf();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [isMobile, src]);

  if (isMobile || status === "error") {
    return (
      <div className="flex h-full min-h-60 flex-col items-center justify-center gap-3 bg-background px-6 text-center">
        <div className="space-y-1">
          <p className="text-xs font-medium text-foreground">
            {isMobile ? "Open PDF" : "PDF preview unavailable"}
          </p>
          <p className="max-w-xs text-xs text-muted-foreground">
            {isMobile
              ? "Use the browser viewer for the most reliable mobile preview."
              : "The file can still be opened or downloaded."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" asChild>
            <a href={src} target="_blank" rel="noreferrer">
              <ArrowSquareOutIcon className="size-3.5" />
              Open
            </a>
          </Button>
          <Button type="button" variant="secondary" size="sm" onClick={onDownload}>
            <DownloadSimpleIcon className="size-3.5" />
            Download
          </Button>
        </div>
      </div>
    );
  }

  if (status === "loading" || !blobUrl) {
    return (
      <div className="flex h-full min-h-60 items-center justify-center text-xs text-muted-foreground">
        Loading PDF
      </div>
    );
  }

  return (
    <object
      data={`${blobUrl}#toolbar=0&navpanes=0`}
      type="application/pdf"
      title={title}
      className="h-full min-h-0 w-full bg-background"
    >
      <div className="flex h-full min-h-60 items-center justify-center">
        <Button type="button" variant="secondary" size="sm" onClick={onDownload}>
          <DownloadSimpleIcon className="size-3.5" />
          Download PDF
        </Button>
      </div>
    </object>
  );
}
