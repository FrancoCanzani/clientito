import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { AgendaDayGroup } from "@/features/calendar/components/agenda-day-group";
import {
  approveProposedEvent,
  dismissProposedEvent,
  editProposedEvent,
} from "@/features/calendar/mutations";
import { fetchAgendaEvents } from "@/features/calendar/queries";
import type { AgendaEvent } from "@/features/calendar/types";
import { ArrowRightIcon } from "@phosphor-icons/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";

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
  days = 7,
  showEmptyState = true,
  hideProposed = false,
  showHeader = false,
}: {
  days?: number;
  showEmptyState?: boolean;
  hideProposed?: boolean;
  showHeader?: boolean;
}) {
  const queryClient = useQueryClient();
  const [approvingId, setApprovingId] = useState<number | null>(null);

  const { from, to } = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end = new Date(start);
    end.setDate(end.getDate() + days);
    return { from: start.toISOString(), to: end.toISOString() };
  }, [days]);

  const eventsQuery = useQuery({
    queryKey: ["calendar-events", from, to],
    queryFn: () => fetchAgendaEvents(from, to),
    staleTime: 60_000,
  });

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
    let events = eventsQuery.data ?? [];
    if (hideProposed) {
      events = events.filter((e) => e.status !== "pending");
    }
    return groupByDay(events);
  }, [eventsQuery.data, hideProposed]);

  if (eventsQuery.isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-[80%]" />
      </div>
    );
  }

  if (eventsQuery.isError) {
    return null;
  }

  if (dayGroups.length === 0) {
    if (!showEmptyState) {
      return null;
    }

    return (
      <Empty className="min-h-32 border-0 p-0">
        <EmptyHeader>
          <EmptyTitle>No upcoming events</EmptyTitle>
          <EmptyDescription>
            Your calendar is clear for the next {days} days.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="space-y-4">
      {showHeader && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Today</p>
          <Link to="/agenda" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
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
