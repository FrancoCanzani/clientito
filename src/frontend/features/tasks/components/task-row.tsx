import { PrioritySelect } from "@/features/tasks/components/priority-select";
import { StatusSelect } from "@/features/tasks/components/status-select";
import { TaskEditor } from "@/features/tasks/components/task-editor";
import { useTaskActions } from "@/features/tasks/hooks/use-task-actions";
import type { Task } from "@/features/tasks/types";
import { isOverdue } from "@/features/tasks/utils";
import { cn } from "@/lib/utils";
export function TaskRow({
  task,
  isEditing,
}: {
  task: Task;
  isEditing: boolean;
}) {
  const {
    isUpdateSubmitting,
    onStatusChange,
    onPriorityChange,
    onToggleEdit,
    onCancelEdit,
    onDelete,
    onSubmitEdit,
  } = useTaskActions();

  const overdue = isOverdue(task);

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
          {task.dueTime && (
            <span className="font-mono text-[10px] text-muted-foreground">
              {task.dueTime}
            </span>
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
