import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TaskStatus } from "@/features/tasks/types";
import { STATUS_LABELS, STATUS_ORDER } from "@/features/tasks/utils";
import { cn } from "@/lib/utils";
import { useState } from "react";

const STATUS_COLORS: Record<TaskStatus, string> = {
  backlog: "border-muted-foreground/40",
  todo: "border-foreground",
  in_progress: "border-amber-500 bg-amber-500/20",
  done: "border-green-500 bg-green-500/20",
};

function StatusDot({ status }: { status: TaskStatus }) {
  return (
    <span
      className={cn(
        "inline-block size-2.5 rounded-full border-2",
        STATUS_COLORS[status],
      )}
    />
  );
}

export function StatusSelect({
  value,
  onValueChange,
  size = "default",
  iconOnly = false,
}: {
  value: TaskStatus;
  onValueChange: (status: TaskStatus) => void;
  size?: "default" | "sm";
  iconOnly?: boolean;
}) {
  const [open, setOpen] = useState(false);

  if (iconOnly) {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button type="button" className="shrink-0" title="Status">
            <StatusDot status={value} />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-1" align="start">
          {STATUS_ORDER.map((s) => (
            <button
              key={s}
              type="button"
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors hover:bg-accent",
                s === value && "bg-accent",
              )}
              onClick={() => {
                onValueChange(s);
                setOpen(false);
              }}
            >
              <StatusDot status={s} />
              {STATUS_LABELS[s]}
            </button>
          ))}
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Select value={value} onValueChange={(v) => onValueChange(v as TaskStatus)}>
      <SelectTrigger className={cn(size === "sm" ? "h-7 text-xs" : "h-9")}>
        <SelectValue asChild>
          <span className="flex items-center gap-2">
            <StatusDot status={value} />
            {STATUS_LABELS[value]}
          </span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {STATUS_ORDER.map((s) => (
          <SelectItem key={s} value={s}>
            <span className="flex items-center gap-2">
              <StatusDot status={s} />
              {STATUS_LABELS[s]}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
