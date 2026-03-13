import CompaniesListPage from "@/features/companies/pages/companies-list-page";
import { fetchCompanies } from "@/features/companies/api";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_dashboard/companies/")({
  loader: async () => fetchCompanies(),
  component: CompaniesListPage,
});
