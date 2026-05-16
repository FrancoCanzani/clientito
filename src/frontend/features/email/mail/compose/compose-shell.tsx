import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ArrowsInIcon,
  ArrowsOutIcon,
  MinusIcon,
  XIcon,
} from "@phosphor-icons/react";
import type { ReactNode } from "react";
import type { DraftStatus } from "@/features/email/mail/compose/use-draft";

function DraftStatusIndicator({ status }: { status: DraftStatus }) {
  if (status !== "saved") return null;
  return <span className="text-[10px] text-muted-foreground">Saved</span>;
}

export type ComposeShellProps = {
  title: string;
  draftStatus: DraftStatus;
  onClose: () => void;
  onMinimize?: () => void;
  onToggleMode?: () => void;
  mode: "modal" | "dock";
  collapsed?: boolean;
  onHeaderClick?: () => void;
  containerClassName?: string;
  children?: ReactNode;
};

export function ComposeShell({
  title,
  draftStatus,
  onClose,
  onMinimize,
  onToggleMode,
  mode,
  collapsed = false,
  onHeaderClick,
  containerClassName,
  children,
}: ComposeShellProps) {
  return (
    <div
      className={cn(
        "flex min-h-0 flex-col overflow-hidden rounded border border-border/40 bg-card shadow-2xl",
        containerClassName,
      )}
    >
      <div
        className={cn(
          "flex shrink-0 items-center justify-between gap-3 border-b border-border/40 px-3 py-2",
          onHeaderClick && "cursor-pointer select-none",
        )}
        onClick={onHeaderClick}
      >
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-xs font-medium">{title}</h3>
        </div>
        <div
          className="flex items-center gap-1"
          onClick={(event) => event.stopPropagation()}
        >
          <DraftStatusIndicator status={draftStatus} />
          {onMinimize && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onMinimize}
              aria-label={collapsed ? "Expand compose" : "Minimize compose"}
            >
              <MinusIcon className="size-3" />
            </Button>
          )}
          {onToggleMode && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onToggleMode}
              aria-label={
                mode === "dock" ? "Open in modal" : "Collapse to dock"
              }
            >
              {mode === "dock" ? (
                <ArrowsOutIcon className="size-3" />
              ) : (
                <ArrowsInIcon className="size-3" />
              )}
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Close compose"
          >
            <XIcon className="size-3" />
          </Button>
        </div>
      </div>
      {!collapsed && children}
    </div>
  );
}
