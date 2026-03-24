import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { HomeBriefingItem } from "@/features/home/queries";
import { patchEmail } from "@/features/inbox/mutations";
import {
  ArchiveIcon,
  ChatCircleDotsIcon,
  CheckCircleIcon,
  EnvelopeOpenIcon,
} from "@phosphor-icons/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

function extractEmailId(href: string): string | null {
  const match = href.match(/[?&]id=(\d+)/);
  return match?.[1] ?? null;
}

export function TriageCard({
  item,
  index,
  onDismiss,
}: {
  item: HomeBriefingItem;
  index: number;
  onDismiss: (id: string) => void;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const emailId = extractEmailId(item.href);
  const isTask = item.type === "overdue_task" || item.type === "due_today_task";

  const archiveMutation = useMutation({
    mutationFn: async () => {
      if (!emailId) return;
      await patchEmail(emailId, { archived: true, isRead: true });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["emails"] });
      onDismiss(item.id);
    },
  });

  const markReadMutation = useMutation({
    mutationFn: async () => {
      if (!emailId) return;
      await patchEmail(emailId, { isRead: true });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["emails"] });
      onDismiss(item.id);
    },
  });

  return (
    <div className="group rounded-lg border border-border bg-card p-2">
      <div className="flex items-start justify-between gap-3">
        <button
          type="button"
          className="flex-1 space-y-2 cursor-pointer bg-transparent text-left"
          onClick={() => navigate({ to: item.href })}
        >
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">{item.title}</span>
            {item.type === "reply" && (
              <span className="inline-flex items-center rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                Reply needed
              </span>
            )}
            {item.type === "fyi" && (
              <span className="inline-flex items-center rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                FYI
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
          </div>
          <p className="text-xs text-muted-foreground">{item.reason}</p>
        </button>

        <div className="flex items-center gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
          {!isTask && emailId && (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 transition-transform duration-100 active:scale-95"
                    onClick={() => navigate({ to: item.href })}
                  >
                    <EnvelopeOpenIcon className="size-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Open</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 transition-transform duration-100 active:scale-95"
                    onClick={() => archiveMutation.mutate()}
                    disabled={archiveMutation.isPending}
                  >
                    <ArchiveIcon className="size-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Archive</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 transition-transform duration-100 active:scale-95"
                    onClick={() => markReadMutation.mutate()}
                    disabled={markReadMutation.isPending}
                  >
                    <ChatCircleDotsIcon className="size-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Mark read</TooltipContent>
              </Tooltip>
            </>
          )}
          {isTask && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 transition-transform duration-100 active:scale-95"
                  onClick={() => navigate({ to: item.href })}
                >
                  <CheckCircleIcon className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">View task</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
    </div>
  );
}
