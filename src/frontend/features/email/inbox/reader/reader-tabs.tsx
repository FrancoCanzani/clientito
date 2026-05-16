import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { cn } from "@/lib/utils";
import { XIcon } from "@phosphor-icons/react";
import type { ReaderTab } from "../hooks/use-reader-tabs";

export function ReaderTabs({
  pinned,
  ephemeral,
  activeId,
  onSwitch,
  onClose,
  onPin,
  onCloseOthers,
  onCloseAll,
}: {
  pinned: ReaderTab[];
  ephemeral: ReaderTab | null;
  activeId: string | null;
  onSwitch: (id: string) => void;
  onClose: (id: string) => void;
  onPin: (id: string) => void;
  onCloseOthers: (id: string) => void;
  onCloseAll: () => void;
}) {
  if (pinned.length === 0 && !ephemeral) return null;

  const items: Array<ReaderTab & { ephemeral: boolean }> = [
    ...pinned.map((t) => ({ ...t, ephemeral: false })),
    ...(ephemeral ? [{ ...ephemeral, ephemeral: true }] : []),
  ];
  const hasOthers = items.length > 1;

  return (
    <div className="scrollbar-none flex h-10 min-h-10 shrink-0 items-stretch overflow-x-auto border-b border-border/40 bg-background">
      {items.map((tab) => {
        const isActive = tab.id === activeId;
        return (
          <ContextMenu key={tab.id}>
            <ContextMenuTrigger asChild>
              <div
                role="tab"
                aria-selected={isActive}
                onClick={() => onSwitch(tab.id)}
                onAuxClick={(e) => {
                  if (e.button === 1) {
                    e.preventDefault();
                    onClose(tab.id);
                  }
                }}
                className={cn(
                  "group flex w-44 shrink-0 cursor-default items-center gap-1.5 border-r border-border/40 px-2.5 text-xs transition-colors",
                  isActive
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:bg-muted/60",
                  tab.ephemeral && "italic",
                )}
                title={tab.subject || "(no subject)"}
              >
                <span
                  className={cn(
                    "min-w-0 truncate",
                    tab.ephemeral && !isActive && "opacity-70",
                  )}
                >
                  {tab.subject || "(no subject)"}
                </span>
                <button
                  type="button"
                  aria-label="Close tab"
                  onClick={(e) => {
                    e.stopPropagation();
                    onClose(tab.id);
                  }}
                  className={cn(
                    "flex size-4 shrink-0 items-center justify-center text-muted-foreground transition-opacity hover:text-foreground",
                    isActive
                      ? "opacity-100"
                      : "opacity-0 group-hover:opacity-100",
                  )}
                >
                  <XIcon className="size-3" />
                </button>
              </div>
            </ContextMenuTrigger>
            <ContextMenuContent>
              {tab.ephemeral && (
                <>
                  <ContextMenuItem onSelect={() => onPin(tab.id)}>
                    Pin tab
                  </ContextMenuItem>
                  <ContextMenuSeparator />
                </>
              )}
              <ContextMenuItem onSelect={() => onClose(tab.id)}>
                Close
              </ContextMenuItem>
              <ContextMenuItem
                onSelect={() => onCloseOthers(tab.id)}
                disabled={!hasOthers}
              >
                Close others
              </ContextMenuItem>
              <ContextMenuItem onSelect={onCloseAll}>Close all</ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        );
      })}
    </div>
  );
}
