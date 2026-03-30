import { createTask, deleteTask, updateTask } from "@/features/tasks/mutations";
import type { TaskPriority, TaskStatus } from "@/features/tasks/types";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { toast } from "sonner";

export function useTaskMutations({
  closeEditor,
}: {
  closeEditor: () => void;
}) {
  const router = useRouter();

  const invalidateTasks = () => {
    router.invalidate();
  };

  const createTaskMutation = useMutation({
    mutationFn: createTask,
    onSuccess: () => {
      closeEditor();
      invalidateTasks();
    },
    onError: () => toast.error("Failed to create task"),
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({
      taskId,
      input,
    }: {
      taskId: number;
      input: Parameters<typeof updateTask>[1];
    }) => updateTask(taskId, input),
    onSuccess: () => {
      closeEditor();
      invalidateTasks();
    },
    onError: () => toast.error("Failed to update task"),
  });

  const statusMutation = useMutation({
    mutationFn: ({ taskId, status }: { taskId: number; status: TaskStatus }) =>
      updateTask(taskId, { status }),
    onSuccess: invalidateTasks,
    onError: () => toast.error("Failed to update status"),
  });

  const priorityMutation = useMutation({
    mutationFn: ({
      taskId,
      priority,
    }: {
      taskId: number;
      priority: TaskPriority;
    }) => updateTask(taskId, { priority }),
    onSuccess: invalidateTasks,
    onError: () => toast.error("Failed to update priority"),
  });

  const deleteTaskMutation = useMutation({
    mutationFn: deleteTask,
    onSuccess: () => {
      closeEditor();
      invalidateTasks();
    },
    onError: () => toast.error("Failed to delete task"),
  });

  return {
    createTaskMutation,
    updateTaskMutation,
    statusMutation,
    priorityMutation,
    deleteTaskMutation,
  };
}
