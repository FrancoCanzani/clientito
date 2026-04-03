import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { DecisionQueue } from "@/features/home/components/card-stack";
import type { HomeBriefingItem } from "@/features/home/queries";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";

function truncateCopy(value: string, maxLength: number) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trimEnd()}...`;
}

function getSenderPresentation(item: HomeBriefingItem) {
  const fromName = item.fromName?.trim();

  return {
    senderName: fromName || item.fromAddr || item.title,
  };
}

function formatEventRange(item: HomeBriefingItem) {
  if (!item.eventStart) return item.reason;
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(item.eventStart);
}

function getSummaryText(item: HomeBriefingItem) {
  if (item.type === "overdue_task" || item.type === "due_today_task") {
    return item.reason ? `${item.title}. ${item.reason}` : item.title;
  }

  return item.reason || item.title;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getInlineSummaryText(
  item: HomeBriefingItem,
  summaryText: string,
  senderName: string,
) {
  const normalized = summaryText.trim();
  if (
    item.type !== "email_action" &&
    item.type !== "briefing_email" &&
    item.type !== "calendar_suggestion"
  ) {
    return normalized;
  }

  const candidates = [senderName].filter(Boolean) as string[];

  for (const candidate of candidates) {
    const pattern = new RegExp(`^${escapeRegExp(candidate)}\\s+`, "i");
    if (pattern.test(normalized)) {
      return normalized.replace(pattern, "");
    }
  }

  return normalized;
}

function getPrimaryAction({
  item,
  draft,
  isEditing,
  navigate,
  queue,
}: {
  item: HomeBriefingItem;
  draft: string;
  isEditing: boolean;
  navigate: ReturnType<typeof useNavigate>;
  queue: DecisionQueue;
}) {
  if (item.type === "calendar_suggestion") {
    return {
      label: "Calendar",
      detail: formatEventRange(item),
      dismissLabel: "Decline",
      onDismiss: () => queue.dismissEvent(item.id),
      primaryLabel: "Schedule",
      onPrimary: () => queue.approveEvent(item.id),
    };
  }

  if (item.type === "overdue_task" || item.type === "due_today_task") {
    return {
      label: item.type === "overdue_task" ? "Overdue" : "Due today",
      detail: item.title,
      dismissLabel: "Skip",
      onDismiss: () => queue.dismiss(item.id),
      primaryLabel: "Done",
      onPrimary: () => queue.completeTask(item.id),
    };
  }

  if (item.type === "briefing_email") {
    return {
      label: "Email",
      detail: item.subject || "Open this message",
      dismissLabel: "Skip",
      onDismiss: () => queue.dismiss(item.id),
      primaryLabel: "Open",
      onPrimary: () => navigate({ to: item.href }),
    };
  }

  if (item.actionType === "archive") {
    return {
      label: "Archive",
      detail: "Move this thread out of the inbox",
      dismissLabel: "Dismiss",
      onDismiss: () => queue.dismiss(item.id),
      primaryLabel: "Archive",
      onPrimary: () => queue.archiveItem(item.id),
    };
  }

  if (item.actionType === "reply") {
    return {
      label: "Draft",
      detail: truncateCopy(draft || item.reason || item.title, 96),
      dismissLabel: "Dismiss",
      onDismiss: () => queue.dismiss(item.id),
      primaryLabel: isEditing ? "Hide Draft" : "Review Reply",
      onPrimary: () => queue.toggleEditing(item.id),
    };
  }

  return {
    label: "Email action",
    detail: item.subject || "Open this message",
    dismissLabel: "Dismiss",
    onDismiss: () => queue.dismiss(item.id),
    primaryLabel: "Open Email",
    onPrimary: () => navigate({ to: item.href }),
  };
}

export function TriageCard({
  item,
  queue,
}: {
  item: HomeBriefingItem;
  queue: DecisionQueue;
  isActive?: boolean;
}) {
  const navigate = useNavigate();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const draft = queue.drafts[item.id] ?? item.draftReply ?? "";
  const isEditing = queue.editingId === item.id;
  const isSending = queue.sendingId === item.id;
  const { senderName } = getSenderPresentation(item);
  const summaryText = getSummaryText(item);
  const inlineSummaryText = getInlineSummaryText(item, summaryText, senderName);
  const action = getPrimaryAction({
    item,
    draft,
    isEditing,
    navigate,
    queue,
  });

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(
        textareaRef.current.value.length,
        textareaRef.current.value.length,
      );
    }
  }, [isEditing]);

  return (
    <div className="overflow-hidden rounded-md border border-border/40">
      <button
        type="button"
        className="block w-full text-start text-pretty"
        onClick={() => navigate({ to: item.href })}
      >
        <p className="text-sm px-4 py-3 rounded-b-md shadow-xs">
          {(item.type === "email_action" ||
            item.type === "briefing_email" ||
            item.type === "calendar_suggestion") && (
            <>
              <span className="font-medium">{senderName}</span>
              <span className="ml-1">{inlineSummaryText}</span>
            </>
          )}
          {(item.type === "overdue_task" || item.type === "due_today_task") && (
            <>
              <span>{item.type === "overdue_task" ? "Overdue" : "Today"}</span>
              <span className="ml-1">{inlineSummaryText}</span>
            </>
          )}
          {item.type !== "email_action" &&
            item.type !== "briefing_email" &&
            item.type !== "calendar_suggestion" &&
            item.type !== "overdue_task" &&
            item.type !== "due_today_task" &&
            inlineSummaryText}
        </p>
      </button>

      <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between bg-muted">
        <div className="flex min-w-0 items-center gap-2.5 text-muted-foreground text-xs">
          <div className="min-w-0 truncate">
            <span className="mr-1 font-medium text-primary">
              {action.label}
            </span>
            <span className="truncate">{action.detail}</span>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            variant={"destructive"}
            onClick={action.onDismiss}
          >
            {action.dismissLabel}
          </Button>
          <Button
            type="button"
            variant={"outline"}
            className="bg-background"
            disabled={isSending}
            onClick={action.onPrimary}
          >
            {isSending ? "Sending..." : action.primaryLabel}
          </Button>
        </div>
      </div>

      {item.actionType === "reply" && draft && isEditing && (
        <div className="px-4 py-3">
          <div className="space-y-3">
            <Textarea
              ref={textareaRef}
              className="min-h-32 w-full text-xs resize-none rounded-md"
              rows={5}
              value={draft}
              onChange={(event) =>
                queue.updateDraft(item.id, event.target.value)
              }
            />
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="destructive"
                onClick={() => queue.toggleEditing(item.id)}
              >
                Cancel
              </Button>
              <Button
                variant={"outline"}
                disabled={isSending}
                onClick={() => queue.sendReply(item.id)}
              >
                {isSending ? "Sending..." : "Send"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
