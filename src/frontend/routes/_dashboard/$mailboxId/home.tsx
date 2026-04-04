import { fetchAgendaEvents } from "@/features/calendar/queries";
import HomePage from "@/features/home/pages/home-page";
import { fetchBriefing } from "@/features/home/queries";
import { createFileRoute } from "@tanstack/react-router";

function getTodayRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { from: start.toISOString(), to: end.toISOString() };
}

export const Route = createFileRoute("/_dashboard/$mailboxId/home")({
  loader: async ({ params }) => {
    const { from, to } = getTodayRange();
    const [briefing, events] = await Promise.all([
      fetchBriefing(params.mailboxId),
      fetchAgendaEvents(from, to, params.mailboxId),
    ]);
    return { briefing, events };
  },
  component: HomePage,
});
