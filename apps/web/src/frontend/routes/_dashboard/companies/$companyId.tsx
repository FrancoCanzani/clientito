import CompanyDetailPage from "@/features/companies/pages/company-detail-page";
import { fetchCompanyDetail } from "@/features/companies/api";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_dashboard/companies/$companyId")({
  loader: async ({ params }) => fetchCompanyDetail(params.companyId),
  component: CompanyDetailPage,
});
