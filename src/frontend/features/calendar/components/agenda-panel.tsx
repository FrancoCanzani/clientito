import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { AgendaDayGroup } from "@/features/calendar/components/agenda-day-group";
import {
  approveProposedEvent,
  dismissProposedEvent,
  editProposedEvent,
} from "@/features/calendar/mutations";
import type { AgendaEvent } from "@/features/calendar/types";
import { ArrowRightIcon } from "@phosphor-icons/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, getRouteApi } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";

const mailboxRoute = getRouteApi("/_dashboard/$mailboxId");

function groupByDay(events: AgendaEvent[]) {
  const groups = new Map<string, { date: Date; events: AgendaEvent[] }>();

  for (const event of events) {
    const d = new Date(event.startAt);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if (!groups.has(key)) {
      groups.set(key, {
        date: new Date(d.getFullYear(), d.getMonth(), d.getDate()),
        events: [],
      });
    }
    groups.get(key)!.events.push(event);
  }

  return [...groups.values()].sort(
    (a, b) => a.date.getTime() - b.date.getTime(),
  );
}

export function AgendaPanel({
  events,
  showEmptyState = true,
  hideProposed = false,
  showHeader = false,
}: {
  events: AgendaEvent[];
  showEmptyState?: boolean;
  hideProposed?: boolean;
  showHeader?: boolean;
}) {
  const { mailboxId } = mailboxRoute.useParams();
  const queryClient = useQueryClient();
  const [approvingId, setApprovingId] = useState<number | null>(null);

  const approveMutation = useMutation({
    mutationFn: approveProposedEvent,
    onMutate: (proposedId) => setApprovingId(proposedId),
    onSuccess: () => {
      toast.success("Event added to calendar");
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
    },
    onError: () => toast.error("Failed to add event"),
    onSettled: () => setApprovingId(null),
  });

  const dismissMutation = useMutation({
    mutationFn: dismissProposedEvent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
    },
    onError: () => toast.error("Failed to dismiss event"),
  });

  const editMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { title?: string; location?: string; startAt?: number; endAt?: number } }) =>
      editProposedEvent(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
    },
    onError: () => toast.error("Failed to update event"),
  });

  const dayGroups = useMemo(() => {
    let filtered = events;
    if (hideProposed) {
      filtered = filtered.filter((e) => e.status !== "pending");
    }
    return groupByDay(filtered);
  }, [events, hideProposed]);

  if (dayGroups.length === 0) {
    if (!showEmptyState) return null;

    return (
      <Empty className="min-h-0 flex-1 border-0 p-0">
        <EmptyHeader>
          <EmptyTitle>No upcoming events</EmptyTitle>
          <EmptyDescription>Your calendar is clear.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="space-y-4">
      {showHeader && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Today</p>
          <Link
            to="/$mailboxId/agenda"
            params={{ mailboxId }}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            Agenda
            <ArrowRightIcon className="size-3" />
          </Link>
        </div>
      )}
      {dayGroups.map((group) => (
        <AgendaDayGroup
          key={group.date.toISOString()}
          date={group.date}
          events={group.events}
          onApprove={(id) => approveMutation.mutate(id)}
          onDismiss={(id) => dismissMutation.mutate(id)}
          onEdit={(id, data) => editMutation.mutate({ id, data })}
          approvingId={approvingId}
        />
      ))}
    </div>
  );
}
