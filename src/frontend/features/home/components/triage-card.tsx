import { Button } from "@/components/ui/button";
import type { DecisionQueue } from "@/features/home/components/card-stack";
import type { HomeBriefingItem } from "@/features/home/queries";
import {
  ArchiveIcon,
  CalendarPlusIcon,
  CheckCircleIcon,
  EnvelopeSimpleIcon,
  PaperPlaneRightIcon,
  PencilSimpleIcon,
} from "@phosphor-icons/react";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-border/70 bg-background px-2.5 py-1 text-[11px] font-medium tracking-[-0.01em] text-foreground/80">
      {children}
    </span>
  );
}

function truncateCopy(value: string, maxLength: number) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trimEnd()}...`;
}

function toTitleCase(value: string) {
  return value
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getDomainLabel(domain: string) {
  const parts = domain
    .split(".")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length >= 2) {
    return toTitleCase(parts[parts.length - 2] ?? parts[0] ?? domain);
  }

  return toTitleCase(parts[0] ?? domain);
}

function getSenderPresentation(item: HomeBriefingItem) {
  const fromName = item.fromName?.trim();
  const domain = item.fromAddr?.split("@")[1]?.trim() ?? null;

  if (fromName) {
    const match = fromName.match(/^(.*?)\s+from\s+(.+)$/i);
    if (match) {
      return {
        senderName: match[1]!.trim(),
        sourceLabel: match[2]!.trim(),
      };
    }
  }

  return {
    senderName: fromName || item.title,
    sourceLabel: domain ? getDomainLabel(domain) : null,
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
      icon: <CalendarPlusIcon className="size-4" />,
      label: "Accept",
      detail: formatEventRange(item),
      dismissLabel: "Decline",
      onDismiss: () => queue.dismissEvent(item.id),
      primaryLabel: "Accept",
      onPrimary: () => queue.approveEvent(item.id),
    };
  }

  if (item.type === "overdue_task" || item.type === "due_today_task") {
    return {
      icon: <CheckCircleIcon className="size-4" />,
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
      icon: <EnvelopeSimpleIcon className="size-4" />,
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
      icon: <ArchiveIcon className="size-4" />,
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
      icon: <PencilSimpleIcon className="size-4" />,
      label: "Draft",
      detail: truncateCopy(draft || item.reason || item.title, 96),
      dismissLabel: "Dismiss",
      onDismiss: () => queue.dismiss(item.id),
      primaryLabel: isEditing ? "Hide Draft" : "Review Reply",
      onPrimary: () => queue.toggleEditing(item.id),
    };
  }

  return {
    icon: <PaperPlaneRightIcon className="size-4" />,
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
  const { senderName, sourceLabel } = getSenderPresentation(item);
  const summaryText = getSummaryText(item);
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
    <div className="overflow-hidden rounded-[22px] border border-border/70 bg-card shadow-[0_1px_0_rgba(15,23,42,0.03)]">
      <button
        type="button"
        className="block w-full bg-background px-4 py-4 text-left transition-colors duration-150 ease-out hover:bg-muted/[0.16]"
        onClick={() => navigate({ to: item.href })}
      >
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          {(item.type === "email_action" || item.type === "briefing_email") && (
            <>
              <Pill>{senderName}</Pill>
              {sourceLabel && <Pill>{sourceLabel}</Pill>}
            </>
          )}
          {item.type === "calendar_suggestion" && <Pill>Suggested event</Pill>}
          {(item.type === "overdue_task" || item.type === "due_today_task") && (
            <Pill>{item.type === "overdue_task" ? "Overdue task" : "Today"}</Pill>
          )}
        </div>

        <p className="mt-3 text-[15px] leading-6 tracking-[-0.02em] text-foreground">
          {summaryText}
        </p>
      </button>

      <div className="flex flex-col gap-3 border-t border-border/70 bg-muted/[0.42] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border/70 bg-background text-foreground/80">
            {action.icon}
          </div>
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              {action.label}
            </p>
            <p className="truncate text-sm text-foreground/85">
              {action.detail}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            className="text-sm text-muted-foreground transition-colors duration-150 ease-out hover:text-foreground"
            onClick={action.onDismiss}
          >
            {action.dismissLabel}
          </button>
          <Button
            type="button"
            size="sm"
            className="min-w-[7.5rem] active:scale-[0.98]"
            disabled={isSending}
            onClick={action.onPrimary}
          >
            {isSending ? "Sending..." : action.primaryLabel}
          </Button>
        </div>
      </div>

      {item.actionType === "reply" && draft && isEditing && (
        <div className="border-t border-border/70 bg-background px-4 py-4">
          <div className="space-y-3">
            <textarea
              ref={textareaRef}
              className="min-h-28 w-full resize-none rounded-2xl border border-border/80 bg-muted/25 px-3 py-3 text-[13px] leading-6 text-foreground outline-none transition-shadow focus:ring-2 focus:ring-primary/15"
              rows={5}
              value={draft}
              onChange={(event) => queue.updateDraft(item.id, event.target.value)}
            />
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="active:scale-[0.98]"
                onClick={() => queue.toggleEditing(item.id)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="min-w-[6rem] active:scale-[0.98]"
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
