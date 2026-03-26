import type { AgendaEvent } from "@/features/calendar/types";
import { AgendaEventRow } from "./agenda-event-row";

const dateFormat = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  month: "short",
  day: "numeric",
});

function getDayLabel(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round(
    (target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  return dateFormat.format(date);
}

export function AgendaDayGroup({
  date,
  events,
  onApprove,
  onDismiss,
  approvingId,
}: {
  date: Date;
  events: AgendaEvent[];
  onApprove?: (proposedId: number) => void;
  onDismiss?: (proposedId: number) => void;
  approvingId?: number | null;
}) {
  return (
    <div className="space-y-1">
      <h3 className="px-2 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
        {getDayLabel(date)}
      </h3>
      <div className="space-y-0.5">
        {events.map((event) => (
          <AgendaEventRow
            key={event.id}
            event={event}
            onApprove={onApprove}
            onDismiss={onDismiss}
            isApproving={approvingId === event.proposedId}
          />
        ))}
      </div>
    </div>
  );
}
