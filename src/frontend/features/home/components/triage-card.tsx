import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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

export function TriageCard({
  item,
  isActive = false,
  draft,
  isLoadingDraft = false,
  isEditing = false,
  isSending = false,
  onDismiss,
  onSendReply,
  onArchive,
  onDraftChange,
  onToggleEdit,
  onApproveEvent,
  onDismissEvent,
}: {
  item: HomeBriefingItem;
  isActive?: boolean;
  draft?: string;
  isLoadingDraft?: boolean;
  isEditing?: boolean;
  isSending?: boolean;
  onDismiss: (id: string) => void;
  onSendReply?: (id: string) => void;
  onArchive?: (id: string) => void;
  onDraftChange?: (id: string, text: string) => void;
  onToggleEdit?: () => void;
  onApproveEvent?: (id: string) => void;
  onDismissEvent?: (id: string) => void;
}) {
  const navigate = useNavigate();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isTask = item.type === "overdue_task" || item.type === "due_today_task";
  const isProposedEvent = item.type === "calendar_suggestion";
  const isEmail = !isTask && !isProposedEvent && !!item.emailId;
  const hasDraft = !!draft;

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
    <>
      <div className="flex items-start justify-between gap-3">
        <button
          type="button"
          className="flex-1 cursor-pointer space-y-2 bg-transparent text-left"
          onClick={() => navigate({ to: item.href })}
        >
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">{item.title}</span>
            {item.type === "email_action" && (
              <span className="inline-flex items-center rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                {item.actionType?.replace(/_/g, " ") ?? "Action"}
              </span>
            )}
            {item.type === "overdue_task" && (
              <span className="inline-flex items-center rounded-full bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium text-destructive">
                Overdue
              </span>
            )}
            {item.type === "due_today_task" && (
              <span className="inline-flex items-center rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                Today
              </span>
            )}
            {item.type === "calendar_suggestion" && (
              <span className="inline-flex items-center rounded-full bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-medium text-blue-600 dark:text-blue-400">
                Suggested event
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{item.reason}</p>
        </button>

        <div
          className={`flex items-center gap-1 transition-opacity duration-150 ${
            isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          }`}
        >
          {isEmail && (
            <>
              {onArchive && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 active:scale-95"
                      onClick={() => onArchive(item.id)}
                    >
                      <ArchiveIcon className="size-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    Archive <Kbd>A</Kbd>
                  </TooltipContent>
                </Tooltip>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 active:scale-95"
                    onClick={() => onDismiss(item.id)}
                  >
                    <XIcon className="size-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  Skip <Kbd>S</Kbd>
                </TooltipContent>
              </Tooltip>
            </>
          )}
          {isTask && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 active:scale-95"
                  onClick={() => navigate({ to: item.href })}
                >
                  <CheckCircleIcon className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">View task</TooltipContent>
            </Tooltip>
          )}
          {isProposedEvent && (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 active:scale-95"
                    onClick={() => onApproveEvent?.(item.id)}
                  >
                    <CalendarPlusIcon className="size-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  Add to calendar <Kbd>Enter</Kbd>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 active:scale-95"
                    onClick={() => onDismissEvent?.(item.id)}
                  >
                    <XIcon className="size-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  Dismiss <Kbd>S</Kbd>
                </TooltipContent>
              </Tooltip>
            </>
          )}
        </div>
      </div>

      {isProposedEvent && (
        <div className="mt-2 space-y-1 border-t border-border pt-2">
          {item.eventLocation && (
            <p className="text-xs text-muted-foreground">{item.eventLocation}</p>
          )}
          {item.eventDescription && (
            <p className="line-clamp-2 text-xs text-muted-foreground">
              {item.eventDescription}
            </p>
          )}
        </div>
      )}

      {isEmail && !isTask && (
        <>
          {isLoadingDraft && !hasDraft && (
            <div className="mt-2 space-y-1.5 border-t border-border pt-2">
              <Skeleton className="h-3 w-[90%]" />
              <Skeleton className="h-3 w-[70%]" />
            </div>
          )}

          {hasDraft && !isEditing && (
            <div className="mt-2 border-t border-border pt-2">
              <button
                type="button"
                className="w-full cursor-pointer bg-transparent text-left"
                onClick={onToggleEdit}
              >
                <p className="line-clamp-2 text-xs text-muted-foreground">
                  {draft}
                </p>
              </button>
              <div className="mt-1.5 flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[11px]"
                  onClick={onToggleEdit}
                >
                  <PencilSimpleIcon className="mr-1 size-3" />
                  Edit
                </Button>
                {onSendReply && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[11px]"
                    disabled={isSending}
                    onClick={() => onSendReply(item.id)}
                  >
                    <PaperPlaneRightIcon className="mr-1 size-3" />
                    {isSending ? "Sending..." : "Send"}
                  </Button>
                )}
              </div>
            </div>
          )}

          {hasDraft && isEditing && (
            <div className="mt-2 space-y-1.5 border-t border-border pt-2">
              <textarea
                ref={textareaRef}
                className="w-full resize-none rounded-md border border-border bg-background p-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary/40"
                rows={4}
                value={draft}
                onChange={(e) => onDraftChange?.(item.id, e.target.value)}
              />
              <div className="flex items-center gap-1">
                {onSendReply && (
                  <Button
                    variant="default"
                    size="sm"
                    className="h-6 text-[11px]"
                    disabled={isSending}
                    onClick={() => onSendReply(item.id)}
                  >
                    <PaperPlaneRightIcon className="mr-1 size-3" />
                    {isSending ? "Sending..." : "Send"}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[11px]"
                  onClick={onToggleEdit}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}
