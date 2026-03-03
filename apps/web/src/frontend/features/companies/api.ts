import type { CompaniesResponse, CompanyDetailResponse } from "./types";

export async function fetchCompanies(params?: {
  q?: string;
}): Promise<CompaniesResponse> {
  const query = new URLSearchParams();
  if (params?.q) query.set("q", params.q);
  const response = await fetch(`/api/companies?${query.toString()}`, {
  });
  if (!response.ok) throw new Error("Failed to fetch companies");
  return response.json();
}

export async function patchCompany(
  companyId: string | number,
  data: {
    name?: string;
    industry?: string | null;
    website?: string | null;
    description?: string | null;
  },
): Promise<void> {
  const response = await fetch(`/api/companies/${companyId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error("Failed to update company");
}

export async function fetchCompanyDetail(
  companyId: string | number,
): Promise<CompanyDetailResponse> {
  const response = await fetch(`/api/companies/${companyId}`);
  if (!response.ok) throw new Error("Failed to fetch company");
  return response.json();
}
