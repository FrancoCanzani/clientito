import type { EmailDetailItem } from "@/features/inbox/types";
import { createTask } from "@/features/tasks/mutations";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { toast } from "sonner";

export function useEmailAiActions({
  email,
  onReplyRequested,
}: {
  email: EmailDetailItem;
  onReplyRequested: (draft?: string) => void;
}) {
  const queryClient = useQueryClient();

  const createTaskMutation = useMutation({
    mutationFn: async ({
      title,
      dueAt,
      priority,
    }: {
      title: string;
      dueAt: number | null;
      priority: "urgent" | "high" | "medium" | "low" | null;
    }) => {
      await createTask({
        title,
        sourceEmailId: Number(email.id),
        ...(dueAt != null && { dueAt }),
        ...(priority && { priority }),
      });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["email-ai-detail", email.id] }),
        queryClient.invalidateQueries({ queryKey: ["tasks"] }),
      ]);
      toast.success("Task created");
    },
    onError: () => toast.error("Failed to create task"),
  });

  const handleReply = useCallback(
    (draft?: string) => onReplyRequested(draft),
    [onReplyRequested],
  );

  const handleCreateTask = useCallback(
    (suggestion: { title: string; dueAt: number | null; priority: "urgent" | "high" | "medium" | "low" | null }) => {
      createTaskMutation.mutate(suggestion);
    },
    [createTaskMutation],
  );

  return {
    handleReply,
    handleCreateTask,
    createTaskPending: createTaskMutation.isPending,
  };
}
