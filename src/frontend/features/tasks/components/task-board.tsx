import { monitorForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { updateTask } from "@/features/tasks/mutations";
import type { Task, TaskStatus } from "@/features/tasks/types";
import { STATUS_ORDER } from "@/features/tasks/utils";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import { TaskBoardColumn } from "./task-board-column";

export function TaskBoard({
  tasks,
  onEdit,
  onPomodoro,
}: {
  tasks: Task[];
  onEdit: (taskId: number) => void;
  onPomodoro: (taskId: number, title: string) => void;
}) {
  const queryClient = useQueryClient();
  const router = useRouter();

  useEffect(() => {
    return monitorForElements({
      onDrop({ source, location }) {
        const target = location.current.dropTargets[0];
        if (!target) return;

        const taskId = source.data.taskId as number;
        const newStatus = target.data.status as TaskStatus;
        if (!taskId || !newStatus) return;

        const task = tasks.find((t) => t.id === taskId);
        if (!task || task.status === newStatus) return;

        void updateTask(taskId, { status: newStatus }).then(() => {
          void queryClient.invalidateQueries({ queryKey: ["tasks"] });
          void router.invalidate();
        });
      },
    });
  }, [tasks, queryClient, router]);

  const grouped = new Map<TaskStatus, Task[]>();
  for (const s of STATUS_ORDER) grouped.set(s, []);
  for (const task of tasks) {
    grouped.get(task.status)?.push(task);
  }

  return (
    <div className="grid grid-cols-4 gap-3">
      {STATUS_ORDER.map((status) => (
        <TaskBoardColumn
          key={status}
          status={status}
          tasks={grouped.get(status) ?? []}
          onEdit={onEdit}
          onPomodoro={onPomodoro}
        />
      ))}
    </div>
  );
}
