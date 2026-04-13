import { XIcon } from "@phosphor-icons/react";
import type { Label } from "../types";

type LabelChipProps = {
  label: Label;
  onRemove?: () => void;
  className?: string;
};

export function LabelChip({ label, onRemove, className }: LabelChipProps) {
  const bg = label.backgroundColor ?? "#e0e0e0";
  const text = label.textColor ?? "#000000";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[11px] font-medium leading-none ${className ?? ""}`}
      style={{ backgroundColor: bg, color: text }}
    >
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
