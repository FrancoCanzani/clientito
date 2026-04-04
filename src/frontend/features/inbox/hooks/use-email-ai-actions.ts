import { postBriefingDecision } from "@/features/home/queries";
import { patchEmail } from "@/features/inbox/mutations";
import type { EmailAction, EmailDetailItem } from "@/features/inbox/types";
import {
  getSnoozeTimestamp,
  getTaskPriority,
  getTaskStatus,
} from "@/features/inbox/utils/email-action-helpers";
import { createTask } from "@/features/tasks/mutations";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { toast } from "sonner";

export function useEmailAiActions({
  email,
  onClose,
  onReplyRequested,
}: {
  email: EmailDetailItem;
  onClose?: () => void;
  onReplyRequested: (draft?: string) => void;
}) {
  const queryClient = useQueryClient();

  const markActionExecuted = useCallback(
    async (action: EmailAction) => {
      if (
        action.type !== "archive" &&
        action.type !== "snooze" &&
        action.type !== "create_task"
      ) {
        return;
      }

      await postBriefingDecision({
        itemType: "email_action",
        referenceId: Number(email.id),
        actionId: action.id,
        decision: action.type === "archive" ? "archived" : "approved",
      });
    },
    [email.id],
  );

  const aiActionMutation = useMutation({
    mutationFn: async (action: EmailAction) => {
      if (action.type === "archive") {
        await patchEmail(email.id, { archived: true });
        return action;
      }

      if (action.type === "snooze") {
        const snoozedUntil = getSnoozeTimestamp(action);
        if (snoozedUntil == null) {
          throw new Error("Missing snooze time");
        }
        await patchEmail(email.id, { snoozedUntil });
        return action;
      }

      if (action.type === "create_task") {
        const title =
          typeof action.payload.taskTitle === "string"
            ? action.payload.taskTitle.trim()
            : "";
        if (!title) throw new Error("Missing task title");

        await createTask({
          title,
          sourceEmailId: Number(email.id),
          ...(typeof action.payload.taskDueAt === "number" && {
            dueAt: action.payload.taskDueAt,
          }),
          ...(getTaskPriority(action.payload) && {
            priority: getTaskPriority(action.payload),
          }),
          ...(getTaskStatus(action.payload) && {
            status: getTaskStatus(action.payload),
          }),
        });
        return action;
      }

      throw new Error("Unsupported AI action");
    },
    onSuccess: async (action) => {
      try {
        await markActionExecuted(action);
      } catch {
        toast.error("Applied action, but failed to update the AI status");
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["emails"] }),
        queryClient.invalidateQueries({ queryKey: ["email-detail", email.id] }),
        queryClient.invalidateQueries({
          queryKey: ["email-ai-detail", email.id],
        }),
        queryClient.invalidateQueries({ queryKey: ["tasks"] }),
        email.threadId
          ? queryClient.invalidateQueries({
              queryKey: ["email-thread", email.threadId],
            })
          : Promise.resolve(),
      ]);

      if (action.type === "archive") {
        toast.success("Archived");
        onClose?.();
        return;
      }

      if (action.type === "create_task") {
        toast.success("Task created");
        return;
      }

      toast.success("Snoozed");
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Failed to apply AI action",
      );
    },
  });

  const handleAiAction = useCallback(
    (action: EmailAction) => {
      if (action.type === "reply") {
        const draft =
          typeof action.payload.draft === "string"
            ? action.payload.draft
            : undefined;
        onReplyRequested(draft);
        return;
      }

      aiActionMutation.mutate(action);
    },
    [aiActionMutation, onReplyRequested],
  );

  return {
    aiActionMutation,
    handleAiAction,
    markActionExecuted,
  };
}
