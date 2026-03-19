import TasksPage from "@/features/tasks/pages/tasks-page";
import { fetchTasks } from "@/features/tasks/queries";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const tasksSearchSchema = z.object({
  sort: z.enum(["date", "priority"]).optional(),
  view: z.enum(["all", "today", "upcoming"]).optional(),
  layout: z.enum(["list", "board"]).optional(),
  completed: z.coerce.boolean().optional(),
});

export const Route = createFileRoute("/_dashboard/tasks")({
  validateSearch: tasksSearchSchema,

  loaderDeps: ({ search }) => ({
    view: search.view ?? "all",
    sort: search.sort,
  }),

  loader: ({ deps }) => {
    return fetchTasks({
      view: deps.view === "all" ? undefined : deps.view,
    });
  },

  component: TasksPage,
});
