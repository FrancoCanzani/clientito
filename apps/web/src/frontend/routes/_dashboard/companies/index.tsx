import CompaniesListPage from "@/features/companies/pages/companies-list-page";
import { fetchCompanies } from "@/features/companies/api";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const companiesSearchSchema = z.object({
  q: z.string().trim().optional(),
});

export const Route = createFileRoute("/_dashboard/companies/")({
  validateSearch: companiesSearchSchema,
  loaderDeps: ({ search }) => ({ q: search.q }),
  loader: async ({ deps }) => fetchCompanies({ q: deps.q }),
  component: CompaniesListPage,
});
