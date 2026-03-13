import { SuggestionToast, type EmailSuggestion } from "@/features/emails/components/suggestion-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createElement } from "react";
import { toast } from "sonner";

type SuggestActionsResponse = {
  data: EmailSuggestion[];
};

type ExecuteResponse = {
  data: {
    executed: boolean;
    actionType: string;
    emailId?: number;
    instructions?: string;
  };
};

async function suggestActions(emailIds: number[]): Promise<EmailSuggestion[]> {
  const response = await fetch("/api/ai/suggest-actions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ emailIds }),
  });
  if (!response.ok) throw new Error("Failed to get suggestions");
  const json: SuggestActionsResponse = await response.json();
  return json.data;
}

async function executeSuggestion(suggestionId: number): Promise<ExecuteResponse["data"]> {
  const response = await fetch("/api/ai/execute-suggestion", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ suggestionId }),
  });
  if (!response.ok) throw new Error("Failed to execute suggestion");
  const json: ExecuteResponse = await response.json();
  return json.data;
}

async function dismissSuggestion(suggestionId: number): Promise<void> {
  await fetch("/api/ai/dismiss-suggestion", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ suggestionId }),
  });
}

type EmailInfo = {
  id: number;
  fromName: string | null;
  fromAddr: string;
  subject: string | null;
};

export function useSuggestedActions() {
  const queryClient = useQueryClient();

  const executeMutation = useMutation({
    mutationFn: executeSuggestion,
    onSuccess: (data) => {
      if (data.actionType === "add_task" || data.actionType === "follow_up") {
        void queryClient.invalidateQueries({ queryKey: ["tasks"] });
        toast.success("Task created");
      } else if (data.actionType === "archive") {
        void queryClient.invalidateQueries({ queryKey: ["emails"] });
        toast.success("Email archived");
      } else if (data.actionType === "draft_reply") {
        toast.info("Opening draft reply...");
      }
    },
    onError: () => {
      toast.error("Failed to execute action");
    },
  });

  const dismissMutation = useMutation({
    mutationFn: dismissSuggestion,
  });

  async function triggerSuggestions(recentEmails: EmailInfo[]) {
    if (recentEmails.length === 0) return;

    const emailIds = recentEmails.slice(0, 10).map((e) => e.id);

    try {
      const suggestions = await suggestActions(emailIds);
      if (suggestions.length === 0) return;

      // Group suggestions by emailId
      const byEmail = new Map<number, EmailSuggestion[]>();
      for (const s of suggestions) {
        const existing = byEmail.get(s.emailId) ?? [];
        existing.push(s);
        byEmail.set(s.emailId, existing);
      }

      const emailMap = new Map(recentEmails.map((e) => [e.id, e]));
      let toastCount = 0;
      const MAX_TOASTS = 3;

      for (const [emailId, emailSuggestions] of byEmail) {
        if (toastCount >= MAX_TOASTS) break;

        const email = emailMap.get(emailId);
        if (!email) continue;

        const toastId = `suggestion-${emailId}`;
        toast(
          createElement(SuggestionToast, {
            toastId,
            senderName: email.fromName || email.fromAddr,
            subject: email.subject || "(no subject)",
            suggestions: emailSuggestions,
            onExecute: (id: number) => executeMutation.mutate(id),
            onDismiss: (id: number) => dismissMutation.mutate(id),
          }),
          {
            id: toastId,
            duration: 15000,
          },
        );
        toastCount++;
      }

      // Summary toast if there are more
      const remaining = byEmail.size - toastCount;
      if (remaining > 0) {
        toast.info(`${remaining} more email${remaining > 1 ? "s" : ""} need attention`, {
          duration: 10000,
        });
      }
    } catch (error) {
      console.error("Failed to get email suggestions", error);
    }
  }

  return { triggerSuggestions };
}
