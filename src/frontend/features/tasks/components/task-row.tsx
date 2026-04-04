import { PrioritySelect } from "@/features/tasks/components/priority-select";
import { StatusSelect } from "@/features/tasks/components/status-select";
import { TaskEditor } from "@/features/tasks/components/task-editor";
import type { TaskEditorSubmitValue } from "@/features/tasks/components/task-editor";
import type { Task, TaskPriority, TaskStatus } from "@/features/tasks/types";
import { isOverdue } from "@/features/tasks/utils";
import { cn } from "@/lib/utils";

type TaskRowActions = {
  isUpdateSubmitting: boolean;
  onStatusChange: (taskId: number, status: TaskStatus) => void;
  onPriorityChange: (taskId: number, priority: TaskPriority) => void;
  onToggleEdit: (taskId: number) => void;
  onCancelEdit: () => void;
  onDelete: (taskId: number) => void;
  onSubmitEdit: (taskId: number, value: TaskEditorSubmitValue) => void;
};

function formatDueTime(dueAt: number) {
  const date = new Date(dueAt);
  const hours = date.getHours();
  const minutes = date.getMinutes();

  if (hours === 12 && minutes === 0) {
    return null;
  }

  return `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}`;
}

export function TaskRow({
  task,
  isEditing,
  actions,
}: {
  task: Task;
  isEditing: boolean;
  actions: TaskRowActions;
}) {
  const {
    isUpdateSubmitting,
    onStatusChange,
    onPriorityChange,
    onToggleEdit,
    onCancelEdit,
    onDelete,
    onSubmitEdit,
  } = actions;

  const overdue = isOverdue(task);
  const dueTime = task.dueAt ? formatDueTime(task.dueAt) : null;

  return (
    <div>
      <div
        className={cn(
          "group flex h-9 items-center gap-2 rounded-md px-2 transition-colors hover:bg-muted/35",
          overdue && "bg-red-500/5",
        )}
      >
        <PrioritySelect
          value={task.priority}
          onValueChange={(p) => onPriorityChange(task.id, p)}
          iconOnly
        />

        <StatusSelect
          value={task.status}
          onValueChange={(status) => onStatusChange(task.id, status)}
          iconOnly
        />

        <button
          type="button"
          className="min-w-0 flex-1 truncate text-left text-sm"
          onClick={() => onToggleEdit(task.id)}
        >
          <span
            className={cn(
              task.status === "done"
                ? "text-muted-foreground line-through"
                : "text-foreground",
              overdue && "text-red-600",
            )}
          >
            {task.title}
          </span>
        </button>

        <div className="flex shrink-0 items-center gap-1.5">
          {dueTime && (
            <span className="text-xs text-muted-foreground">{dueTime}</span>
          )}
        </div>
      </div>

      {isEditing && (
        <TaskEditor
          key={`edit-${task.id}`}
          task={task}
          submitLabel="Save changes"
          isSubmitting={isUpdateSubmitting}
          onCancel={onCancelEdit}
          onDelete={() => onDelete(task.id)}
          onSubmit={(value) => onSubmitEdit(task.id, value)}
        />
      )}
    </div>
  );
}
