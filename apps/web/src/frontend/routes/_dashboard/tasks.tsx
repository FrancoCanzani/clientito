import TasksPage from "@/features/tasks/pages/tasks-page";
import { fetchTasks } from "@/features/tasks/queries";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const tasksSearchSchema = z.object({
  sort: z.enum(["date", "priority"]).optional(),
});

export const Route = createFileRoute("/_dashboard/tasks")({
  validateSearch: tasksSearchSchema,
  loader: () => fetchTasks(),
  component: TasksPage,
});
