import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { DecisionQueue } from "@/features/home/components/card-stack";
import type { HomeBriefingItem } from "@/features/home/queries";
import {
  ArchiveIcon,
  CalendarPlusIcon,
  CheckCircleIcon,
  PaperPlaneRightIcon,
  PencilSimpleIcon,
  XIcon,
} from "@phosphor-icons/react";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";

function Badge({
  children,
  variant = "default",
}: {
  children: React.ReactNode;
  variant?: "default" | "destructive" | "amber" | "blue";
}) {
  const colors = {
    default: "bg-primary/10 text-primary",
    destructive: "bg-destructive/10 text-destructive",
    amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ${colors[variant]}`}
    >
      {children}
    </span>
  );
}

function getBadge(type: HomeBriefingItem["type"]) {
  switch (type) {
    case "email_action":
      return <Badge>Action needed</Badge>;
    case "briefing_email":
      return <Badge>Needs attention</Badge>;
    case "overdue_task":
      return <Badge variant="destructive">Overdue</Badge>;
    case "due_today_task":
      return <Badge variant="amber">Today</Badge>;
    case "calendar_suggestion":
      return <Badge variant="blue">Suggested event</Badge>;
    default:
      return null;
  }
}

export function TriageCard({
  item,
  queue,
  isActive = false,
}: {
  item: HomeBriefingItem;
  queue: DecisionQueue;
  isActive?: boolean;
}) {
  const navigate = useNavigate();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isTask = item.type === "overdue_task" || item.type === "due_today_task";
  const isProposedEvent = item.type === "calendar_suggestion";
  const isEmail = !isTask && !isProposedEvent && !!item.emailId;

  const draft = queue.drafts[item.id];
  const isEditing = queue.editingId === item.id;
  const isSending = queue.sendingId === item.id;

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
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-3">
        <button
          type="button"
          className="flex-1 cursor-pointer space-y-1.5 bg-transparent text-left"
          onClick={() => navigate({ to: item.href })}
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">{item.title}</span>
            {getBadge(item.type)}
          </div>
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            {item.reason}
          </p>
        </button>

        <div
          className={`flex shrink-0 items-center gap-0.5 transition-opacity duration-150 ${
            isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          }`}
        >
          {isEmail && (
            <ActionButton
              icon={<ArchiveIcon className="size-3.5" />}
              label="Archive"
              kbd="A"
              onClick={() => queue.archiveItem(item.id)}
            />
          )}
          {(isEmail || isTask) && (
            <ActionButton
              icon={<XIcon className="size-3.5" />}
              label="Skip"
              kbd="S"
              onClick={() => queue.dismiss(item.id)}
            />
          )}
          {isTask && (
            <ActionButton
              icon={<CheckCircleIcon className="size-3.5" />}
              label="Done"
              kbd="Enter"
              onClick={() => queue.completeTask(item.id)}
            />
          )}
          {isProposedEvent && (
            <>
              <ActionButton
                icon={<CalendarPlusIcon className="size-3.5" />}
                label="Add to calendar"
                kbd="Enter"
                onClick={() => queue.approveEvent(item.id)}
              />
              <ActionButton
                icon={<XIcon className="size-3.5" />}
                label="Dismiss"
                kbd="S"
                onClick={() => queue.dismissEvent(item.id)}
              />
            </>
          )}
        </div>
      </div>

      {isProposedEvent && (item.eventLocation || item.eventDescription) && (
        <div className="space-y-1 border-t border-border/60 pt-2">
          {item.eventLocation && (
            <p className="text-xs text-muted-foreground">
              {item.eventLocation}
            </p>
          )}
          {item.eventDescription && (
            <p className="text-xs text-muted-foreground">
              {item.eventDescription}
            </p>
          )}
        </div>
      )}

      {isEmail && draft && !isEditing && (
        <div className="border-t border-border/60 pt-2">
          <p className="text-[13px] leading-relaxed text-muted-foreground/80">
            {draft}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => queue.toggleEditing(item.id)}
            >
              <PencilSimpleIcon className="size-3" />
              Edit
            </button>
            <button
              type="button"
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
              disabled={isSending}
              onClick={() => queue.sendReply(item.id)}
            >
              <PaperPlaneRightIcon className="size-3" />
              {isSending ? "Sending..." : "Send"}
            </button>
          </div>
        </div>
      )}

      {isEmail && draft && isEditing && (
        <div className="space-y-2 border-t border-border/60 pt-2">
          <textarea
            ref={textareaRef}
            className="w-full resize-none rounded-md border border-border bg-background p-2 text-[13px] leading-relaxed focus:outline-none focus:ring-1 focus:ring-primary/40"
            rows={4}
            value={draft}
            onChange={(e) => queue.updateDraft(item.id, e.target.value)}
          />
          <div className="flex items-center gap-2">
            <Button
              variant="default"
              size="sm"
              className="h-7 text-xs"
              disabled={isSending}
              onClick={() => queue.sendReply(item.id)}
            >
              <PaperPlaneRightIcon className="mr-1 size-3" />
              {isSending ? "Sending..." : "Send"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => queue.toggleEditing(item.id)}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function ActionButton({
  icon,
  label,
  kbd,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  kbd: string;
  onClick: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-7 active:scale-95"
          onClick={onClick}
        >
          {icon}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        {label} <Kbd>{kbd}</Kbd>
      </TooltipContent>
    </Tooltip>
  );
}
