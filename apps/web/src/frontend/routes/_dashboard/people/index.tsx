import PeopleListPage from "@/features/people/pages/people-list-page";
import { fetchPeople } from "@/features/people/api";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const peopleSearchSchema = z.object({
  q: z.string().trim().optional(),
});

export const Route = createFileRoute("/_dashboard/people/")({
  validateSearch: peopleSearchSchema,
  loaderDeps: ({ search }) => ({ q: search.q }),
  loader: async ({ deps }) => fetchPeople({ q: deps.q, limit: 50, offset: 0 }),
  component: PeopleListPage,
});
