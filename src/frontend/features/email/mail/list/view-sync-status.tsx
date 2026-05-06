import { Button } from "@/components/ui/button";
import type { ViewSyncStatus } from "@/features/email/mail/hooks/use-mail-view-data";
import { cn } from "@/lib/utils";
import { ArrowClockwiseIcon } from "@phosphor-icons/react";

export function ViewSyncStatusControl({
  status,
  onRefresh,
  disabled,
  className,
}: {
  status: ViewSyncStatus;
  onRefresh: () => void;
  disabled?: boolean;
  className?: string;
}) {
  const isBusy =
    status.kind === "refreshing" || status.kind === "fetching_first_page";
  const title =
    status.kind === "reconnect_required"
      ? "Reconnect this mailbox before refreshing"
      : `${status.label}: ${status.detail}`;

  return (
    <div className={cn("flex items-center", className)}>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="text-muted-foreground"
        onClick={onRefresh}
        disabled={disabled || isBusy || status.kind === "reconnect_required"}
        title={title}
        aria-label="Refresh current view"
      >
        <ArrowClockwiseIcon
          className={cn("size-3.5", isBusy && "animate-spin duration-75")}
        />
      </Button>
    </div>
  );
}
