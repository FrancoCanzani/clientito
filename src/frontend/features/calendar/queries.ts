import { queryOptions } from "@tanstack/react-query";
import type { AgendaEvent } from "./types";

type AgendaEventsScope = {
  from: string;
  to: string;
  mailboxId: number;
};

export async function fetchAgendaEvents(
  from: string,
  to: string,
  mailboxId: number,
): Promise<AgendaEvent[]> {
  const params = new URLSearchParams({ from, to, mailboxId: String(mailboxId) });
  const response = await fetch(`/api/calendar/events?${params}`);
  if (!response.ok) throw new Error("Failed to fetch calendar events");
  return (await response.json()) as AgendaEvent[];
}

export function agendaEventsQueryOptions({
  from,
  to,
  mailboxId,
}: AgendaEventsScope) {
  return queryOptions({
    queryKey: ["calendar-events", mailboxId, from, to] as const,
    queryFn: () => fetchAgendaEvents(from, to, mailboxId),
    staleTime: 60_000,
  });
}
