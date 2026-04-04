import { Button } from "@/components/ui/button";
import type { EmailAction, EmailDetailIntelligence } from "@/features/inbox/types";
import {
  formatActionTimestamp,
  getAiActionButtonLabel,
  getSnoozeTimestamp,
  isSupportedAiAction,
} from "@/features/inbox/utils/email-action-helpers";
import type { Task } from "@/features/tasks/types";
import {
  ArchiveIcon,
  CheckCircleIcon,
  ClockIcon,
  WarningIcon,
} from "@phosphor-icons/react";

export function EmailOverviewPanel({
  intelligence,
  summary,
  summaryLoading,
  onAiAction,
  aiActionPending,
  linkedTasks,
  onMarkSpam,
  spamPending,
}: {
  intelligence: EmailDetailIntelligence;
  summary: string | null;
  summaryLoading: boolean;
  onAiAction: (action: EmailAction) => void;
  aiActionPending: boolean;
  linkedTasks: Task[];
  onMarkSpam: () => void;
  spamPending: boolean;
}) {
  const pendingActions = intelligence.actions
    .filter(isSupportedAiAction)
    .filter(
      (action) => action.type !== "create_task" || linkedTasks.length === 0,
    );
  const replyDraft = pendingActions.find(
    (action) =>
      action.type === "reply" &&
      typeof action.payload.draft === "string" &&
      action.payload.draft.trim().length > 0,
  );
  const executedConfirmations = intelligence.actions.flatMap((action) => {
    if (action.status !== "executed") return [];
    if (action.type === "archive") {
      return [
        {
          id: `${action.id}-archive`,
          icon: ArchiveIcon,
          text: "Archived",
        },
      ];
    }

    if (action.type === "snooze") {
      const until = getSnoozeTimestamp(action);
      return [
        {
          id: `${action.id}-snooze`,
          icon: ClockIcon,
          text: until
            ? `Snoozed until ${formatActionTimestamp(until)}`
            : "Snoozed",
        },
      ];
    }

    if (action.type === "create_task" && linkedTasks.length === 0) {
      return [
        {
          id: `${action.id}-task`,
          icon: CheckCircleIcon,
          text: "Task created",
        },
      ];
    }

    return [];
  });

  return (
    <section className="space-y-4 rounded-md border border-border/40 p-3">
      {intelligence.suspicious.isSuspicious && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 gap-2.5">
              <WarningIcon className="mt-0.5 size-4 shrink-0 text-amber-700" />
              <div className="min-w-0 space-y-1">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-amber-800">
                  Suspicious email
                </p>
                <p className="text-sm text-foreground">
                  {intelligence.suspicious.reason ??
                    "This message shows signs of phishing or impersonation."}
                </p>
                {intelligence.suspicious.confidence && (
                  <p className="text-xs text-amber-900/80">
                    Confidence: {intelligence.suspicious.confidence}
                  </p>
                )}
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-amber-500/30 bg-background/80"
              disabled={spamPending}
              onClick={onMarkSpam}
            >
              {spamPending ? "Marking..." : "Mark as spam"}
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <h3 className="text-sm font-medium tracking-[-0.6px] text-foreground">
          Overview
        </h3>
        {summary ? (
          <p className="text-xs tracking-[-0.2px] text-foreground/90">
            {summary}
          </p>
        ) : summaryLoading ? (
          <p className="animate-pulse text-xs tracking-[-0.2px] text-muted-foreground">
            Summarizing...
          </p>
        ) : null}
      </div>

      {replyDraft && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium tracking-[-0.6px] text-foreground">
            Draft reply
          </h3>
          <p className="text-xs tracking-[-0.2px] text-foreground/90">
            {String(replyDraft.payload.draft ?? "")}
          </p>
        </div>
      )}

      {pendingActions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {pendingActions.map((action) => (
            <Button
              key={action.id}
              type="button"
              variant="secondary"
              disabled={aiActionPending}
              onClick={() => onAiAction(action)}
            >
              {getAiActionButtonLabel(action)}
            </Button>
          ))}
        </div>
      )}

      {linkedTasks.length > 0 && (
        <div className="space-y-1.5">
          {linkedTasks.map((task) => (
            <div
              key={task.id}
              className="flex items-center gap-2 text-xs text-muted-foreground"
            >
              <CheckCircleIcon className="size-3.5 text-foreground/70" />
              <span className="truncate">{task.title}</span>
            </div>
          ))}
        </div>
      )}

      {executedConfirmations.length > 0 && (
        <div className="space-y-1.5">
          {executedConfirmations.map((confirmation) => (
            <div
              key={confirmation.id}
              className="flex items-center gap-2 text-xs text-muted-foreground"
            >
              <confirmation.icon className="size-3.5 text-foreground/70" />
              <span>{confirmation.text}</span>
            </div>
          ))}
        </div>
      )}

      {intelligence.calendarEvents.some(
        (event) => event.status === "pending",
      ) && (
        <div className="space-y-2 border-t border-border/70 pt-3">
          {intelligence.calendarEvents
            .filter((event) => event.status === "pending")
            .map((event) => (
              <div key={event.id} className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">
                  {event.title}
                </span>
                {" · "}
                {event.isAllDay
                  ? new Date(event.startAt).toLocaleDateString()
                  : new Date(event.startAt).toLocaleString()}
              </div>
            ))}
        </div>
      )}
    </section>
  );
}
