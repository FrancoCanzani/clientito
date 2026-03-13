import DashboardHomePage from "@/features/dashboard/pages/dashboard-home-page";
import { fetchEmails } from "@/features/emails/queries/fetch-emails";
import { fetchPeople } from "@/features/people/api";
import { fetchTasks } from "@/features/tasks/api";
import { createFileRoute } from "@tanstack/react-router";

function getLocalDayBounds(now: Date) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  end.setMilliseconds(end.getMilliseconds() - 1);

  return { start: start.getTime(), end: end.getTime() };
}

export const Route = createFileRoute("/_dashboard/home")({
  loader: async () => {
    const now = new Date();
    const { start, end } = getLocalDayBounds(now);
    const staleThreshold = now.getTime() - 7 * 24 * 60 * 60 * 1000;
    const staleWindowStart = now.getTime() - 60 * 24 * 60 * 60 * 1000;

    const [
      unreadPrimaryEmails,
      dueTodayTasks,
      overdueTasks,
      staleContacts,
    ] = await Promise.all([
      fetchEmails({
        category: "primary",
        isRead: "false",
        limit: 8,
        offset: 0,
      }),
      fetchTasks({
        done: false,
        dueAfter: start,
        dueBefore: end,
        limit: 8,
        offset: 0,
      }),
      fetchTasks({
        done: false,
        dueBefore: start - 1,
        limit: 8,
        offset: 0,
      }),
      fetchPeople({
        lastContactedAfter: staleWindowStart,
        lastContactedBefore: staleThreshold,
        sort: "lastContactedAsc",
        limit: 8,
        offset: 0,
      }),
    ]);

    return {
      unreadPrimaryEmails: unreadPrimaryEmails.data,
      unreadPrimaryEmailCount: unreadPrimaryEmails.pagination.total,
      dueTodayTasks: dueTodayTasks.data,
      dueTodayTaskCount: dueTodayTasks.pagination.total,
      overdueTasks: overdueTasks.data,
      overdueTaskCount: overdueTasks.pagination.total,
      staleContacts: staleContacts.data,
      staleContactCount: staleContacts.pagination.total,
    };
  },
  staleTime: 30 * 1000,
  component: DashboardHomePage,
});
