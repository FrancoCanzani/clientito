import { XIcon } from "@phosphor-icons/react";
import type { Label } from "../types";

type LabelChipProps = {
  label: Label;
  onRemove?: () => void;
  className?: string;
};

export function LabelChip({ label, onRemove, className }: LabelChipProps) {
  const color = label.backgroundColor ?? "#999";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background px-2 py-0.5 text-[11px] font-medium leading-none text-foreground ${className ?? ""}`}
    >
      <span
        className="size-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: color }}
      />
      {label.name}
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-0.5 rounded-sm opacity-60 hover:opacity-100"
        >
          <XIcon className="size-3" />
        </button>
      )}
    </span>
  );
}
