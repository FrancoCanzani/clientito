import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Task, TaskPriority } from "@/features/tasks/types";
import { fromTaskDateInputValue, toTaskDateInputValue } from "@/features/tasks/utils";
import { format } from "date-fns";
import { useEffect, useState } from "react";

const PRIORITY_OPTIONS: Array<{
  value: TaskPriority;
  label: string;
  description: string;
}> = [
  { value: "urgent", label: "urgent", description: "urgent" },
  { value: "high", label: "high", description: "high" },
  { value: "medium", label: "medium", description: "medium" },
  { value: "low", label: "low", description: "low" },
];

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
  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [dueDate, setDueDate] = useState(
    toTaskDateInputValue(task?.dueAt ?? defaultDueAt ?? null),
  );
  const [priority, setPriority] = useState<TaskPriority>(
    task?.priority ?? "low",
  );

  useEffect(() => {
    setTitle(task?.title ?? "");
    setDescription(task?.description ?? "");
    setDueDate(toTaskDateInputValue(task?.dueAt ?? defaultDueAt ?? null));
    setPriority(task?.priority ?? "low");
  }, [defaultDueAt, task]);

  const isSheet = variant === "sheet";
  const contentClassName = isSheet
    ? "space-y-3 px-4 pb-4"
    : "space-y-2 rounded-md bg-muted/25 px-2.5 py-2.5";
  const minDate = format(new Date(), "yyyy-MM-dd");

  return (
    <form
      className={contentClassName}
      onSubmit={(event) => {
        event.preventDefault();

        const normalizedTitle = title.trim();
        if (!normalizedTitle) return;

        const normalizedDescription = description.trim();

        onSubmit({
          title: normalizedTitle,
          description: normalizedDescription ? normalizedDescription : null,
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
        className={`border-border/40 bg-background text-sm shadow-none ${
          isSheet
            ? "h-9"
            : "h-8 border-0 bg-transparent px-0 text-sm font-medium"
        }`}
      />

      <Textarea
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        placeholder="Description"
        className={`resize-none border-border/40 bg-background text-xs shadow-none ${
          isSheet
            ? "min-h-18"
            : "min-h-12 border-0 bg-transparent px-0 py-0.5 text-xs text-muted-foreground"
        }`}
      />

      <div
        className={`flex flex-col gap-2 ${
          isSheet ? "" : "border-t border-border/40 pt-2"
        }`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="date"
            value={dueDate}
            min={minDate}
            onChange={(event) => setDueDate(event.target.value)}
            className={`border-border/50 bg-background text-xs shadow-none ${
              isSheet ? "h-9 w-full sm:w-[180px]" : "h-7 w-[150px]"
            }`}
          />

          <Select
            value={priority}
            onValueChange={(value) => setPriority(value as TaskPriority)}
          >
            <SelectTrigger
              className={`border-border/50 bg-background text-xs shadow-none ${
                isSheet ? "h-9 w-full sm:w-[140px]" : "h-7 w-[110px]"
              }`}
            >
              <SelectValue placeholder="Priority" className="capitalize" />
            </SelectTrigger>
            <SelectContent>
              {PRIORITY_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  <span className="capitalize">{option.label}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between gap-2">
          <div>
            {onDelete ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onDelete}
                disabled={isSubmitting}
                className="border-border/50 text-destructive hover:bg-destructive/5 hover:text-destructive"
              >
                Delete
              </Button>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onCancel}
              disabled={isSubmitting}
              className="border-border/50"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="outline"
              size="sm"
              disabled={isSubmitting || !title.trim()}
              className="border-border/50 bg-background"
            >
              {submitLabel}
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}
