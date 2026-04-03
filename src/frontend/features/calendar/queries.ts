import { queryOptions } from "@tanstack/react-query";
import type { AgendaEvent } from "./types";

type AgendaEventsScope = {
  from: string;
  to: string;
};

export async function fetchAgendaEvents(
  from: string,
  to: string,
): Promise<AgendaEvent[]> {
  const params = new URLSearchParams({ from, to });
  const response = await fetch(`/api/calendar/events?${params}`);
  if (!response.ok) throw new Error("Failed to fetch calendar events");
  const json = await response.json();
  return (json as { data: AgendaEvent[] }).data;
}

export function agendaEventsQueryOptions({ from, to }: AgendaEventsScope) {
  return queryOptions({
    queryKey: ["calendar-events", from, to] as const,
    queryFn: () => fetchAgendaEvents(from, to),
    staleTime: 60_000,
  });
}
