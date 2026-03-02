import TasksPage from "@/features/tasks/pages/tasks-page";
import { fetchCompanies } from "@/features/companies/api";
import { fetchPeople } from "@/features/people/api";
import { fetchTasks } from "@/features/tasks/api";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_dashboard/tasks")({
  loader: async () => {
    const [tasksResponse, peopleResponse, companiesResponse] = await Promise.all([
      fetchTasks({ limit: 200, offset: 0 }),
      fetchPeople({ limit: 100, offset: 0 }),
      fetchCompanies(),
    ]);

    return {
      tasks: tasksResponse.data,
      people: peopleResponse.data,
      companies: companiesResponse.data,
    };
  },
  component: TasksPage,
});
