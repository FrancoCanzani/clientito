import AgendaPage from "@/features/calendar/pages/agenda-page";
import { agendaEventsQueryOptions } from "@/features/calendar/queries";
import { queryClient } from "@/lib/query-client";
import { createFileRoute } from "@tanstack/react-router";

function getAgendaRange(days: number) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start);
  end.setDate(end.getDate() + days);
  return {
    from: start.toISOString(),
    to: end.toISOString(),
  };
}

export const Route = createFileRoute("/_dashboard/agenda")({
  loader: () => {
    const range = getAgendaRange(14);
    return queryClient.ensureQueryData(agendaEventsQueryOptions(range));
  },
  component: AgendaPage,
});
