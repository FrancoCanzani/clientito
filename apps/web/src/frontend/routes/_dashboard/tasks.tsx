import TasksPage from "@/features/tasks/pages/tasks-page";
import { fetchTasks } from "@/features/tasks/queries";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_dashboard/tasks")({
  loader: () => fetchTasks(),
  component: TasksPage,
});
