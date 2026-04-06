import {
  approveProposedEvent,
  dismissProposedEvent,
} from "@/features/calendar/mutations";
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

  const approveSuggestionMutation = useMutation({
    mutationFn: approveProposedEvent,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["email-ai-detail", email.id] }),
        queryClient.invalidateQueries({ queryKey: ["calendar-events"] }),
      ]);
      toast.success("Event added to calendar");
    },
    onError: () => toast.error("Failed to approve event"),
  });

  const dismissSuggestionMutation = useMutation({
    mutationFn: dismissProposedEvent,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["email-ai-detail", email.id] }),
        queryClient.invalidateQueries({ queryKey: ["calendar-events"] }),
      ]);
      toast.success("Suggestion dismissed");
    },
    onError: () => toast.error("Failed to dismiss suggestion"),
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

  const handleApproveCalendarSuggestion = useCallback(
    (suggestionId: number) => {
      approveSuggestionMutation.mutate(suggestionId);
    },
    [approveSuggestionMutation],
  );

  const handleDismissCalendarSuggestion = useCallback(
    (suggestionId: number) => {
      dismissSuggestionMutation.mutate(suggestionId);
    },
    [dismissSuggestionMutation],
  );

  return {
    handleReply,
    handleCreateTask,
    handleApproveCalendarSuggestion,
    handleDismissCalendarSuggestion,
    createTaskPending: createTaskMutation.isPending,
    approveCalendarSuggestionPending: approveSuggestionMutation.isPending,
    dismissCalendarSuggestionPending: dismissSuggestionMutation.isPending,
  };
}
