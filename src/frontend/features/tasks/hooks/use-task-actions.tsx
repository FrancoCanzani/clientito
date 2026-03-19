import type { TaskEditorSubmitValue } from "@/features/tasks/components/task-editor";
import type { TaskPriority, TaskStatus } from "@/features/tasks/types";
import { createContext, useContext } from "react";

export type TaskActions = {
  isUpdateSubmitting: boolean;
  onStatusChange: (taskId: number, status: TaskStatus) => void;
  onPriorityChange: (taskId: number, priority: TaskPriority) => void;
  onToggleEdit: (taskId: number) => void;
  onCancelEdit: () => void;
  onDelete: (taskId: number) => void;
  onSubmitEdit: (taskId: number, value: TaskEditorSubmitValue) => void;
};

const TaskActionsContext = createContext<TaskActions | null>(null);

export const TaskActionsProvider = TaskActionsContext.Provider;

export function useTaskActions() {
  const ctx = useContext(TaskActionsContext);
  if (!ctx) throw new Error("useTaskActions must be used within TaskActionsProvider");
  return ctx;
}
