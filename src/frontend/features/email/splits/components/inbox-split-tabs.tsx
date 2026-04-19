import type { SplitViewRow } from "@/db/schema";
import { cn } from "@/lib/utils";

export type InboxSplitTabsProps = {
  splits: SplitViewRow[];
  activeSplitId: string | null;
  onSelect: (splitId: string | null) => void;
};

export function InboxSplitTabs({
  splits,
  activeSplitId,
  onSelect,
}: InboxSplitTabsProps) {
  const visible = splits
    .filter((s) => s.visible)
    .sort((a, b) => a.position - b.position || a.createdAt - b.createdAt);

  if (visible.length === 0) return null;

  return (
    <div className="flex items-center gap-1 text-xs">
      {visible.map((split) => {
        const active = activeSplitId === split.id;
        return (
          <button
            key={split.id}
            type="button"
            onClick={() => onSelect(active ? null : split.id)}
            className={cn(
              "inline-flex h-7 shrink-0 items-center rounded-md border px-2 transition-colors",
              active
                ? "border-primary/50 bg-primary/10 text-foreground"
                : "border-border/60 bg-transparent text-muted-foreground hover:text-foreground hover:border-foreground/30",
            )}
          >
            {split.name}
          </button>
        );
      })}
    </div>
  );
}
