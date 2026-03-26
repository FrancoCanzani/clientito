import type { AgendaEvent } from "./types";

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
