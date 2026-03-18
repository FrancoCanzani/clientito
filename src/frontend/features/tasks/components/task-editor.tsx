import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import type { Task, TaskPriority } from "@/features/tasks/types";
import {
  fromTaskDateInputValue,
  getPriorityFlagClassName,
  toTaskDateInputValue,
} from "@/features/tasks/utils";
import { cn } from "@/lib/utils";
import { FlagIcon } from "@phosphor-icons/react";
import { format, startOfToday } from "date-fns";
import { useState } from "react";

const PRIORITY_OPTIONS: TaskPriority[] = ["urgent", "high", "medium", "low"];

function getInitialValues(task?: Task | null, defaultDueAt?: number | null) {
  return {
    title: task?.title ?? "",
    description: task?.description ?? "",
    dueDate: toTaskDateInputValue(task?.dueAt ?? defaultDueAt ?? null),
    priority: task?.priority ?? "low",
  } as const;
}

type TaskEditorSubmitValue = {
  title: string;
  description: string | null;
  dueAt: number | null;
  priority: TaskPriority;
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
  const initialValues = getInitialValues(task, defaultDueAt);
  const [title, setTitle] = useState(initialValues.title);
  const [description, setDescription] = useState(initialValues.description);
  const [dueDate, setDueDate] = useState(initialValues.dueDate);
  const [priority, setPriority] = useState<TaskPriority>(
    initialValues.priority,
  );

  const isSheet = variant === "sheet";

  const selectedDate = dueDate ? new Date(`${dueDate}T12:00:00`) : undefined;

  return (
    <form
      className={cn(
        "flex flex-col border border-border/50 shadow-2xs gap-4 rounded-md p-3",
        isSheet && "border-none",
      )}
      onSubmit={(event) => {
        event.preventDefault();

        if (!title.trim()) return;

        onSubmit({
          title: title.trim(),
          description: description.trim() ? description.trim() : null,
          dueAt: fromTaskDateInputValue(dueDate),
          priority,
        });
      }}
    >
      <Input
        autoFocus={autoFocus}
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="Task title"
      />

      <Input
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        placeholder="Description"
      />

      <div className="flex items-end w-full gap-2 justify-between">
        <div className="flex items-center gap-2">
          <div className="gap-1 flex-col flex">
            <Label>Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className=" justify-between data-[empty=true]:text-muted-foreground"
                >
                  {selectedDate ? format(selectedDate, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) =>
                    setDueDate(date ? format(date, "yyyy-MM-dd") : "")
                  }
                  disabled={(date) => date < startOfToday()}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="gap-1 flex-col flex">
            <Label>Priority</Label>
            <Select
              value={priority}
              onValueChange={(value) => setPriority(value as TaskPriority)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Priority" asChild>
                  <span className="flex items-center gap-2 capitalize">
                    <FlagIcon
                      size={12}
                      weight="fill"
                      className={getPriorityFlagClassName(priority)}
                    />
                    {priority}
                  </span>
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {PRIORITY_OPTIONS.map((priorityOption) => (
                  <SelectItem key={priorityOption} value={priorityOption}>
                    <span className="flex items-center gap-2 capitalize">
                      <FlagIcon
                        size={12}
                        weight="fill"
                        className={getPriorityFlagClassName(priorityOption)}
                      />
                      {priorityOption}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2">
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
            variant="destructive"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="outline"
            disabled={isSubmitting || !title.trim()}
          >
            {submitLabel}
          </Button>
        </div>
      </div>
    </form>
  );
}
