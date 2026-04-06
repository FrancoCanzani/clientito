import { Button } from "@/components/ui/button";
import type {
  CalendarSuggestion,
  EmailDetailIntelligence,
  EmailSuspiciousFlag,
} from "@/features/inbox/types";
import {
  CalendarIcon,
  CheckSquareIcon,
  WarningIcon,
} from "@phosphor-icons/react";

export function EmailAiPanel({
  intelligence,
  onReply,
  onCreateTask,
  onApproveCalendarSuggestion,
  onDismissCalendarSuggestion,
  createTaskPending,
  approveCalendarSuggestionPending,
  dismissCalendarSuggestionPending,
}: {
  intelligence: EmailDetailIntelligence;
  onReply: (draft?: string) => void;
  onCreateTask: (suggestion: {
    title: string;
    dueAt: number | null;
    priority: "urgent" | "high" | "medium" | "low" | null;
  }) => void;
  onApproveCalendarSuggestion: (suggestionId: number) => void;
  onDismissCalendarSuggestion: (suggestionId: number) => void;
  createTaskPending: boolean;
  approveCalendarSuggestionPending: boolean;
  dismissCalendarSuggestionPending: boolean;
}) {
  return (
    <section className="space-y-4 rounded-md border border-border/40 p-3">
      {intelligence.suspicious.isSuspicious && (
        <SuspiciousWarning suspicious={intelligence.suspicious} />
      )}

      {intelligence.summary && (
        <div className="space-y-1.5">
          <h3 className="text-sm font-medium tracking-[-0.6px]">Overview</h3>
          <p className="text-xs tracking-[-0.2px] text-foreground/90">
            {intelligence.summary}
          </p>
        </div>
      )}

      {intelligence.replyDraft && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium tracking-[-0.6px]">
            Suggested reply
          </h3>
          <p className="text-xs tracking-[-0.2px] text-foreground/80 leading-relaxed">
            {intelligence.replyDraft}
          </p>
          <Button
            type="button"
            variant="outline"
            className="border-dashed"
            onClick={() => onReply(intelligence.replyDraft ?? undefined)}
          >
            Use draft
          </Button>
        </div>
      )}

      {intelligence.taskSuggestion && (
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <CheckSquareIcon className="size-3.5" />
            <div className="min-w-0 flex gap-2">
              <p className="text-xs text-foreground/90 truncate">
                {intelligence.taskSuggestion.title}
              </p>
              {intelligence.taskSuggestion.dueAt && (
                <p className="text-xs text-muted-foreground">
                  Due{" "}
                  {new Date(
                    intelligence.taskSuggestion.dueAt,
                  ).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            className="border-dashed"
            disabled={createTaskPending}
            onClick={() => onCreateTask(intelligence.taskSuggestion!)}
          >
            Create task
          </Button>
        </div>
      )}

      {intelligence.calendarSuggestion &&
        intelligence.calendarSuggestion.status === "pending" && (
          <CalendarSuggestionRow
            suggestion={intelligence.calendarSuggestion}
            onApprove={onApproveCalendarSuggestion}
            onDismiss={onDismissCalendarSuggestion}
            approvePending={approveCalendarSuggestionPending}
            dismissPending={dismissCalendarSuggestionPending}
          />
        )}
    </section>
  );
}

export function EmailAiPanelLoading() {
  return (
    <section className="space-y-3 rounded-md border border-border/40 p-3">
      <div className="space-y-1.5">
        <div className="h-4 w-16 animate-pulse rounded bg-muted" />
        <div className="h-3 w-full animate-pulse rounded bg-muted" />
        <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
      </div>
    </section>
  );
}

function SuspiciousWarning({
  suspicious,
}: {
  suspicious: EmailSuspiciousFlag;
}) {
  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-3">
      <div className="flex min-w-0 gap-2.5">
        <WarningIcon className="mt-0.5 size-4 shrink-0 text-amber-700" />
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-amber-800">
            Suspicious email
          </p>
          <p className="text-sm text-foreground">
            {suspicious.reason ??
              "This message shows signs of phishing or impersonation."}
          </p>
          {suspicious.confidence && (
            <p className="text-xs text-amber-900/80">
              Confidence: {suspicious.confidence}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function CalendarSuggestionRow({
  suggestion,
  onApprove,
  onDismiss,
  approvePending,
  dismissPending,
}: {
  suggestion: CalendarSuggestion;
  onApprove: (suggestionId: number) => void;
  onDismiss: (suggestionId: number) => void;
  approvePending: boolean;
  dismissPending: boolean;
}) {
  const dateStr = suggestion.isAllDay
    ? new Date(suggestion.startAt).toLocaleDateString()
    : new Date(suggestion.startAt).toLocaleString();

  return (
    <div className="space-y-2 border-t border-border/70 pt-3">
      <div className="flex items-start gap-2">
        <CalendarIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0">
          <p className="text-xs font-medium text-foreground">
            {suggestion.title}
          </p>
          <p className="text-xs text-muted-foreground">{dateStr}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          className="border-dashed"
          disabled={approvePending}
          onClick={() => onApprove(suggestion.id)}
        >
          {approvePending ? "Adding..." : "Add to agenda"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={dismissPending}
          onClick={() => onDismiss(suggestion.id)}
        >
          Dismiss
        </Button>
      </div>
    </div>
  );
}
