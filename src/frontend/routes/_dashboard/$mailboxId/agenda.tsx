import AgendaPage from "@/features/calendar/pages/agenda-page";
import { fetchAgendaEvents } from "@/features/calendar/queries";
import { createFileRoute } from "@tanstack/react-router";

const AGENDA_DAYS = 14;

function getAgendaRange(days: number) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start);
  end.setDate(end.getDate() + days);
  return { from: start.toISOString(), to: end.toISOString() };
}

export const Route = createFileRoute("/_dashboard/$mailboxId/agenda")({
  loader: async ({ params }) => {
    const { from, to } = getAgendaRange(AGENDA_DAYS);
    return fetchAgendaEvents(from, to, params.mailboxId);
  },
  component: AgendaPage,
});
