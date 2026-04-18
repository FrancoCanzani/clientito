import { cn } from "@/lib/utils";
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
    <div
      style={{
        backgroundColor: `color-mix(in oklch, ${color} 20%, transparent)`,
      }}
      className={cn(
        "inline-flex items-center gap-1.5 rounded px-1.5",
        className,
      )}
    >
      <span className="text-[13px]">{label.name}</span>
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="pl-1 h-full border-l border-black rounded-r-md opacity-60 hover:opacity-100"
        >
          <XIcon className="size-3" />
        </button>
      )}
    </div>
  );
}
