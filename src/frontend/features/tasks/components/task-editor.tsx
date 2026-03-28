import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { PrioritySelect } from "@/features/tasks/components/priority-select";
import { StatusSelect } from "@/features/tasks/components/status-select";
import type { Task, TaskPriority, TaskStatus } from "@/features/tasks/types";
import { cn } from "@/lib/utils";
import { CalendarIcon } from "@phosphor-icons/react";
import { format } from "date-fns";
import { useState } from "react";

type FormState = {
  title: string;
  description: string;
  dueAt: Date | undefined;
  priority: TaskPriority;
  status: TaskStatus;
};

function toInitialDate(
  task?: Task | null,
  defaultDueAt?: number | null,
): Date | undefined {
  const ts = task?.dueAt ?? defaultDueAt;
  if (!ts) return undefined;
  return new Date(ts);
}

function getInitialState(
  task?: Task | null,
  defaultDueAt?: number | null,
): FormState {
  return {
    title: task?.title ?? "",
    description: task?.description ?? "",
    dueAt: toInitialDate(task, defaultDueAt),
    priority: task?.priority ?? "low",
    status: task?.status ?? ("todo" as TaskStatus),
  };
}

export type TaskEditorSubmitValue = {
  title: string;
  description: string | null;
  dueAt: number | null;
  priority: TaskPriority;
  status: TaskStatus;
};

export function TaskEditor({
  task,
  defaultDueAt,
  submitLabel,
  isSubmitting,
  onSubmit,
  onCancel,
  onDelete,
  autoFocus = false,
  variant = "inline",
}: {
  task?: Task | null;
  defaultDueAt?: number | null;
  submitLabel: string;
  isSubmitting?: boolean;
  onSubmit: (value: TaskEditorSubmitValue) => void;
  onCancel: () => void;
  onDelete?: () => void;
  autoFocus?: boolean;
  variant?: "inline" | "sheet";
}) {
  const [form, setForm] = useState<FormState>(() =>
    getInitialState(task, defaultDueAt),
  );
  const [dateOpen, setDateOpen] = useState(false);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const isSheet = variant === "sheet";

  const timeValue = form.dueAt
    ? `${form.dueAt.getHours().toString().padStart(2, "0")}:${form.dueAt.getMinutes().toString().padStart(2, "0")}`
    : "";

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) {
      update("dueAt", undefined);
      return;
    }
    const newDate = new Date(date);
    if (form.dueAt) {
      newDate.setHours(form.dueAt.getHours());
      newDate.setMinutes(form.dueAt.getMinutes());
    } else {
      newDate.setHours(12, 0, 0, 0);
    }
    update("dueAt", newDate);
  };

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = e.target.value;
    if (!time) return;
    const [hours, minutes] = time.split(":").map(Number);
    const newDate = form.dueAt ? new Date(form.dueAt) : new Date();
    newDate.setHours(hours);
    newDate.setMinutes(minutes);
    update("dueAt", newDate);
  };

  return (
    <form
      className={cn(
        "flex flex-col border border-border/50 shadow-2xs gap-4 rounded-md p-3",
        isSheet && "border-none shadow-none",
      )}
      action={() => {
        if (!form.title.trim()) return;
        onSubmit({
          title: form.title.trim(),
          description: form.description.trim() || null,
          dueAt: form.dueAt ? form.dueAt.getTime() : null,
          priority: form.priority,
          status: form.status,
        });
      }}
    >
      <div className="flex flex-col gap-1">
        <Label className="text-xs">Title</Label>
        <Input
          autoFocus={autoFocus}
          value={form.title}
          onChange={(e) => update("title", e.target.value)}
          placeholder="What needs to be done?"
        />
      </div>

      <div className="flex flex-col gap-1">
        <Label className="text-xs">Description</Label>
        <Input
          value={form.description}
          onChange={(e) => update("description", e.target.value)}
          placeholder="Add more details..."
        />
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <Label className="text-xs">Status</Label>
          <StatusSelect
            value={form.status}
            onValueChange={(v) => update("status", v)}
          />
        </div>

        <div className="flex flex-col gap-1">
          <Label className="text-xs">Priority</Label>
          <PrioritySelect
            value={form.priority}
            onValueChange={(v) => update("priority", v)}
          />
        </div>

        <div className="flex flex-col gap-1">
          <Label className="text-xs">Date & Time</Label>
          <Popover open={dateOpen} onOpenChange={setDateOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className={cn(
                  "justify-start font-normal",
                  !form.dueAt && "text-muted-foreground",
                )}
              >
                <CalendarIcon className="size-3" />
                {form.dueAt ? format(form.dueAt, "PPP p") : "Pick date & time"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={form.dueAt}
                onSelect={handleDateSelect}
              />
              <div className="border-t p-2">
                <Input
                  type="time"
                  value={timeValue}
                  onChange={handleTimeChange}
                  className="text-xs h-7"
                />
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 pt-1">
        {onDelete && (
          <Button
            type="button"
            variant="destructive"
            onClick={onDelete}
            disabled={isSubmitting}
          >
            Delete
          </Button>
        )}
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting || !form.title.trim()}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
