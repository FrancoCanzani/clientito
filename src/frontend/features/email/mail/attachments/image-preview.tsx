import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  MagnifyingGlassMinusIcon,
  MagnifyingGlassPlusIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";
import { useEffect, useState } from "react";

type ImagePreviewProps = {
  src: string;
  alt: string;
};

const MAX_ZOOM = 2.5;
const MIN_ZOOM = 1;
const ZOOM_STEP = 0.25;

export function ImagePreview({ src, alt }: ImagePreviewProps) {
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    setStatus("loading");
    setZoom(1);
  }, [src]);

  if (status === "error") {
    return (
      <div className="flex h-full min-h-60 flex-col items-center justify-center gap-2 text-muted-foreground">
        <WarningCircleIcon className="size-5" />
        <p className="text-xs">Preview unavailable</p>
      </div>
    );
  }

  return (
    <div className="relative flex h-full min-h-0 w-full items-center justify-center overflow-auto bg-background">
      {status === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
          Loading preview
        </div>
      )}
      <img
        src={src}
        alt={alt}
        draggable={false}
        className={cn(
          "max-h-full max-w-full object-contain transition-opacity duration-150",
          status === "ready" ? "opacity-100" : "opacity-0",
        )}
        style={
          zoom === 1
            ? undefined
            : {
                maxHeight: "none",
                maxWidth: "none",
                width: `${zoom * 100}%`,
              }
        }
        onLoad={() => setStatus("ready")}
        onError={() => setStatus("error")}
      />
      {status === "ready" && (
        <div className="pointer-events-none absolute bottom-3 right-3 hidden gap-1 border border-border/60 bg-popover/95 p-1 shadow-sm sm:flex">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="pointer-events-auto"
            onClick={() => setZoom((value) => Math.max(MIN_ZOOM, value - ZOOM_STEP))}
            disabled={zoom === MIN_ZOOM}
            aria-label="Zoom out"
          >
            <MagnifyingGlassMinusIcon className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="pointer-events-auto w-12 font-mono text-[10px]"
            onClick={() => setZoom(1)}
          >
            {Math.round(zoom * 100)}%
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="pointer-events-auto"
            onClick={() => setZoom((value) => Math.min(MAX_ZOOM, value + ZOOM_STEP))}
            disabled={zoom === MAX_ZOOM}
            aria-label="Zoom in"
          >
            <MagnifyingGlassPlusIcon className="size-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}
