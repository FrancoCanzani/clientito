import { draggable } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import type { Task } from "@/features/tasks/types";
import { getPriorityFlagClassName, isOverdue } from "@/features/tasks/utils";
import { cn } from "@/lib/utils";
import { FlagIcon } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";

function formatCardDue(dueAt: number): string {
  const d = new Date(dueAt);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.round((target.getTime() - today.getTime()) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  if (diff < -1) return `${Math.abs(diff)}d ago`;
  if (diff <= 7) return d.toLocaleDateString("en-US", { weekday: "short" });
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function TaskBoardCard({
  task,
  onEdit,
}: {
  task: Task;
  onEdit: () => void;
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
        {task.dueAt && (
          <span className={cn(
            "ml-auto text-[10px] tabular-nums",
            overdue ? "text-red-500" : "text-muted-foreground",
          )}>
            {formatCardDue(task.dueAt)}
          </span>
        )}
      </div>
    </div>
  );
}
