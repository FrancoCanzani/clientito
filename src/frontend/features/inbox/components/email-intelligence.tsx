import { useEmailAiActions } from "@/features/inbox/hooks/use-email-ai-actions";
import { fetchEmailDetailAI } from "@/features/inbox/queries";
import type { EmailDetailItem } from "@/features/inbox/types";
import { useQuery } from "@tanstack/react-query";
import { EmailAiPanel, EmailAiPanelLoading } from "./email-ai-panel";

export function EmailIntelligence({
  email,
  onReplyRequested,
}: {
  email: EmailDetailItem;
  onReplyRequested: (draft?: string) => void;
}) {
  const detailAIQuery = useQuery({
    queryKey: ["email-ai-detail", email.id],
    queryFn: () => fetchEmailDetailAI(email.id),
  });
  const intelligence = detailAIQuery.data ?? null;

  const {
    handleReply,
    handleCreateTask,
    handleApproveCalendarSuggestion,
    handleDismissCalendarSuggestion,
    createTaskPending,
    approveCalendarSuggestionPending,
    dismissCalendarSuggestionPending,
  } = useEmailAiActions({
    email,
    onReplyRequested,
  });

  return (
    <>
      {detailAIQuery.isFetching && !intelligence && <EmailAiPanelLoading />}

      {intelligence && (
        <EmailAiPanel
          intelligence={intelligence}
          onReply={handleReply}
          onCreateTask={handleCreateTask}
          onApproveCalendarSuggestion={handleApproveCalendarSuggestion}
          onDismissCalendarSuggestion={handleDismissCalendarSuggestion}
          createTaskPending={createTaskPending}
          approveCalendarSuggestionPending={approveCalendarSuggestionPending}
          dismissCalendarSuggestionPending={dismissCalendarSuggestionPending}
        />
      )}

      {detailAIQuery.isError && !intelligence && (
        <p className="rounded-2xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          Could not load AI overview.
        </p>
      )}
    </>
  );
}
