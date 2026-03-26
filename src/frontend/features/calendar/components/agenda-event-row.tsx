import { Button } from "@/components/ui/button";
import type { AgendaEvent } from "@/features/calendar/types";
import { CheckIcon, MapPinIcon, XIcon } from "@phosphor-icons/react";

const timeFormat = new Intl.DateTimeFormat(undefined, {
  hour: "numeric",
  minute: "2-digit",
});

export function AgendaEventRow({
  event,
  onApprove,
  onDismiss,
  isApproving,
}: {
  event: AgendaEvent;
  onApprove?: (proposedId: number) => void;
  onDismiss?: (proposedId: number) => void;
  isApproving?: boolean;
}) {
  const isPending = event.status === "pending";

  return (
    <div
      className={`flex items-start gap-3 rounded-md px-2 py-1.5 ${
        isPending
          ? "border border-dashed border-border bg-muted/30"
          : "hover:bg-muted/40"
      }`}
    >
      <span className="w-16 shrink-0 pt-0.5 text-xs tabular-nums text-muted-foreground">
        {event.isAllDay ? "All day" : timeFormat.format(new Date(event.startAt))}
      </span>

      <div className="min-w-0 flex-1">
        <p className={`text-sm ${isPending ? "text-muted-foreground" : "font-medium"}`}>
          {event.title}
        </p>
        {event.location && (
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <MapPinIcon className="size-3" />
            {event.location}
          </p>
        )}
        {isPending && event.description && (
          <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
            {event.description}
          </p>
        )}
      </div>

      {isPending && event.proposedId != null && (
        <div className="flex shrink-0 items-center gap-0.5">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-[11px]"
            disabled={isApproving}
            onClick={() => onApprove?.(event.proposedId!)}
          >
            <CheckIcon className="mr-1 size-3" />
            {isApproving ? "Adding..." : "Approve"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-[11px]"
            onClick={() => onDismiss?.(event.proposedId!)}
          >
            <XIcon className="size-3" />
          </Button>
        </div>
      )}
    </div>
  );
}
