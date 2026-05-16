import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MinusIcon, XIcon } from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";
import { Rnd } from "react-rnd";
import { ScratchpadEditor } from "./scratchpad-editor";
import {
  loadScratchpadContent,
  loadScratchpadWindowState,
  saveScratchpadContent,
  saveScratchpadWindowState,
  type ScratchpadWindowState,
} from "./scratchpad-storage";

const MIN_WIDTH = 320;
const MIN_HEIGHT = 220;
const SAVE_DELAY_MS = 500;

function clampToViewport(
  state: ScratchpadWindowState,
  visibleHeight = state.height,
): ScratchpadWindowState {
  if (typeof window === "undefined") return state;
  const maxWidth = Math.max(MIN_WIDTH, window.innerWidth - 24);
  const maxHeight = Math.max(MIN_HEIGHT, window.innerHeight - 24);
  const width = Math.min(Math.max(state.width, MIN_WIDTH), maxWidth);
  const height = Math.min(Math.max(state.height, MIN_HEIGHT), maxHeight);
  const x = Math.min(Math.max(state.x, 12), Math.max(12, window.innerWidth - width - 12));
  const y = Math.min(
    Math.max(state.y, 12),
    Math.max(12, window.innerHeight - Math.min(visibleHeight, height) - 12),
  );
  return { x, y, width, height };
}

export function ScratchpadWindow({ onClose }: { onClose: () => void }) {
  const [content, setContent] = useState(() => loadScratchpadContent());
  const [windowState, setWindowState] = useState(() =>
    clampToViewport(loadScratchpadWindowState()),
  );
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => saveScratchpadContent(content), SAVE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [content]);

  useEffect(() => {
    const onResize = () => {
      setWindowState((current) => {
        const next = clampToViewport(current);
        saveScratchpadWindowState(next);
        return next;
      });
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const size = useMemo(
    () => ({
      width: windowState.width,
      height: collapsed ? 41 : windowState.height,
    }),
    [collapsed, windowState.height, windowState.width],
  );

  return (
    <Rnd
      size={size}
      position={{ x: windowState.x, y: windowState.y }}
      minWidth={MIN_WIDTH}
      minHeight={collapsed ? 41 : MIN_HEIGHT}
      bounds="window"
      dragHandleClassName="scratchpad-drag-handle"
      disableDragging={false}
      enableResizing={!collapsed}
      onDragStop={(_, data) => {
        const next = clampToViewport(
          { ...windowState, x: data.x, y: data.y },
          collapsed ? 41 : windowState.height,
        );
        setWindowState(next);
        saveScratchpadWindowState(next);
      }}
      onResizeStop={(_, __, ref, ___, position) => {
        const next = clampToViewport({
          x: position.x,
          y: position.y,
          width: ref.offsetWidth,
          height: ref.offsetHeight,
        });
        setWindowState(next);
        saveScratchpadWindowState(next);
      }}
      className="z-40"
    >
      <div className="flex h-full min-h-0 flex-col overflow-hidden rounded border border-border/50 bg-card shadow-2xl">
        <div className="scratchpad-drag-handle flex shrink-0 cursor-move items-center justify-between gap-3 border-b border-border/40 px-3 py-2">
          <h3 className="text-xs font-medium">Scratchpad</h3>
          <div className="flex items-center gap-1" onPointerDown={(event) => event.stopPropagation()}>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setCollapsed((current) => !current)}
              aria-label={collapsed ? "Expand scratchpad" : "Collapse scratchpad"}
            >
              <MinusIcon className="size-3" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onClose}
              aria-label="Close scratchpad"
            >
              <XIcon className="size-3" />
            </Button>
          </div>
        </div>
        {!collapsed && (
          <div
            className={cn(
              "min-h-0 flex-1 overflow-y-auto px-4 py-3",
              "[&_.ProseMirror]:min-h-full",
              "[&_.ProseMirror_p.is-editor-empty:first-child::before]:whitespace-pre-line",
              "[&_.ProseMirror_p.is-editor-empty:first-child::before]:text-muted-foreground",
            )}
          >
            <ScratchpadEditor initialContent={content} onChange={setContent} />
          </div>
        )}
      </div>
    </Rnd>
  );
}
