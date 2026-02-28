import { fetchBriefing, fetchReminders } from "@/features/dashboard/api";
import DashboardHomePage from "@/features/dashboard/pages/dashboard-home-page";
import { fetchEmails } from "@/features/emails/api";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_dashboard/$orgId/")({
  loader: async ({ params }) => {
    const [unreadPrimaryEmails, reminders, briefing] = await Promise.all([
      fetchEmails(params.orgId, {
        category: "primary",
        isRead: "false",
        limit: 10,
        offset: 0,
      }),
      fetchReminders(params.orgId, "false"),
      fetchBriefing(params.orgId).catch(() => null),
    ]);

    const now = new Date();
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      0,
      0,
      0,
      0,
    ).getTime();
    const endOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      23,
      59,
      59,
      999,
    ).getTime();

    const tasksForToday = reminders
      .filter((task) => task.dueAt >= startOfToday && task.dueAt <= endOfToday)
      .sort((a, b) => a.dueAt - b.dueAt);

    return { unreadPrimaryEmails, tasksForToday, briefing };
  },
  staleTime: 5 * 60 * 1000,
  component: DashboardHomePage,
});
