import { fetchAgendaEvents } from "@/features/calendar/queries";
import HomePage from "@/features/home/pages/home-page";
import { fetchTasks } from "@/features/tasks/queries";
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
    const now = Date.now();
    const [events, dueTodayTasks, overdueTasks] = await Promise.all([
      fetchAgendaEvents(from, to, params.mailboxId),
      fetchTasks({ dueToday: true, limit: 10 }),
      fetchTasks({ dueBefore: now, limit: 5 }),
    ]);
    return { events, dueTodayTasks: dueTodayTasks.data, overdueTasks: overdueTasks.data };
  },
  component: HomePage,
});
