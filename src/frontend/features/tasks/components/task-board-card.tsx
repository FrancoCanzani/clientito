import { draggable } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import type { Task } from "@/features/tasks/types";
import { getPriorityFlagClassName, isOverdue } from "@/features/tasks/utils";
import { cn } from "@/lib/utils";
import { FlagIcon, TimerIcon } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";

export function TaskBoardCard({
  task,
  onEdit,
  onPomodoro,
}: {
  task: Task;
  onEdit: () => void;
  onPomodoro: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const overdue = isOverdue(task);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    return draggable({
      element: el,
      getInitialData: () => ({ taskId: task.id }),
      onDragStart: () => setIsDragging(true),
      onDrop: () => setIsDragging(false),
    });
  }, [task.id]);

  return (
    <div
      ref={ref}
      className={cn(
        "cursor-grab rounded-md border border-border/50 bg-background p-2 shadow-sm transition-opacity",
        isDragging && "opacity-40",
        overdue && "border-red-500/30",
      )}
    >
      <button
        type="button"
        className="w-full text-left"
        onClick={onEdit}
      >
        <p className={cn("text-xs font-medium", overdue && "text-red-600")}>
          {task.title}
        </p>
        {task.description && (
          <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
            {task.description}
          </p>
        )}
      </button>

      <div className="mt-1.5 flex items-center gap-1.5">
        <FlagIcon
          size={10}
          weight="fill"
          className={getPriorityFlagClassName(task.priority)}
        />
        <button
          type="button"
          className="ml-auto text-muted-foreground hover:text-foreground"
          onClick={(e) => {
            e.stopPropagation();
            onPomodoro();
          }}
        >
          <TimerIcon className="size-3" />
        </button>
      </div>
    </div>
  );
}
