import DashboardHomePage from "@/features/dashboard/pages/dashboard-home-page";
import { fetchEmails } from "@/features/emails/queries/fetch-emails";
import { fetchTasks } from "@/features/tasks/api";
import { createFileRoute } from "@tanstack/react-router";

type HomeTask = {
  id: number;
  title: string;
  dueAt: Date;
};

export const Route = createFileRoute("/_dashboard/home")({
  loader: async () => {
    const unreadPrimaryEmails = await fetchEmails({
      category: "primary",
      isRead: "false",
      limit: 10,
      offset: 0,
    });
    const tasksResponse = await fetchTasks({
      dueToday: true,
      limit: 20,
      offset: 0,
    });
    const tasksForToday: HomeTask[] = tasksResponse.data
      .filter((task) => task.dueAt !== null)
      .map((task) => ({
        id: task.id,
        title: task.title,
        dueAt: new Date(task.dueAt!),
      }));
    return { unreadPrimaryEmails, tasksForToday };
  },
  staleTime: 5 * 60 * 1000,
  component: DashboardHomePage,
});
