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
import type { TaskPriority } from "@/features/tasks/types";
import { getPriorityFlagClassName } from "@/features/tasks/utils";
import { cn } from "@/lib/utils";
import { FlagIcon } from "@phosphor-icons/react";
import { useState } from "react";

const PRIORITY_OPTIONS: { value: TaskPriority; label: string }[] = [
  { value: "urgent", label: "Urgent" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

export function PrioritySelect({
  value,
  onValueChange,
  iconOnly = false,
}: {
  value: TaskPriority;
  onValueChange: (priority: TaskPriority) => void;
  iconOnly?: boolean;
}) {
  const [open, setOpen] = useState(false);

  if (iconOnly) {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button type="button" className="shrink-0" title="Priority">
            <FlagIcon
              weight="fill"
              className={getPriorityFlagClassName(value)}
            />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-1" align="start">
          {PRIORITY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors hover:bg-accent",
                opt.value === value && "bg-accent",
              )}
              onClick={() => {
                onValueChange(opt.value);
                setOpen(false);
              }}
            >
              <FlagIcon
                size={12}
                weight="fill"
                className={getPriorityFlagClassName(opt.value)}
              />
              {opt.label}
            </button>
          ))}
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Select
      value={value}
      onValueChange={(v) => onValueChange(v as TaskPriority)}
    >
      <SelectTrigger className="h-9">
        <SelectValue asChild>
          <span className="flex items-center gap-2">
            <FlagIcon
              size={12}
              weight="fill"
              className={getPriorityFlagClassName(value)}
            />
            {PRIORITY_OPTIONS.find((o) => o.value === value)?.label}
          </span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {PRIORITY_OPTIONS.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            <span className="flex items-center gap-2">
              <FlagIcon
                size={12}
                weight="fill"
                className={getPriorityFlagClassName(opt.value)}
              />
              {opt.label}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
