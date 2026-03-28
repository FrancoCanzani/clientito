import { dropTargetForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import type { Task, TaskStatus } from "@/features/tasks/types";
import { STATUS_LABELS } from "@/features/tasks/utils";
import { cn } from "@/lib/utils";
import { useEffect, useReducer, useRef } from "react";
import { TaskBoardCard } from "./task-board-card";

function dragOverReducer(_state: boolean, action: "enter" | "leave") {
  return action === "enter";
}

export function TaskBoardColumn({
  status,
  tasks,
  onEdit,
}: {
  status: TaskStatus;
  tasks: Task[];
  onEdit: (taskId: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [isDragOver, dispatchDragOver] = useReducer(dragOverReducer, false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    return dropTargetForElements({
      element: el,
      getData: () => ({ status }),
      onDragEnter: () => dispatchDragOver("enter"),
      onDragLeave: () => dispatchDragOver("leave"),
      onDrop: () => dispatchDragOver("leave"),
    });
  }, [status]);

  return (
    <div
      ref={ref}
      className={cn(
        "flex min-h-[200px] flex-col rounded-lg border border-border/50 bg-muted/20 p-2 transition-colors",
        isDragOver && "border-foreground/30 bg-muted/40",
      )}
    >
      <div className="mb-2 flex items-center justify-between px-1">
        <h3 className="text-xs font-medium text-muted-foreground">
          {STATUS_LABELS[status]}
        </h3>
        <span className="text-[10px] tabular-nums text-muted-foreground">
          {tasks.length}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-1.5">
        {tasks.map((task) => (
          <TaskBoardCard
            key={task.id}
            task={task}
            onEdit={() => onEdit(task.id)}
          />
        ))}
      </div>
    </div>
  );
}
