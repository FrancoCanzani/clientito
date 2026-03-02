import type { CompaniesResponse, CompanyDetailResponse } from "./types";

export async function fetchCompanies(params?: {
  q?: string;
}): Promise<CompaniesResponse> {
  const query = new URLSearchParams();
  if (params?.q) query.set("q", params.q);
  const response = await fetch(`/api/companies?${query.toString()}`, {
    credentials: "include",
  });
  if (!response.ok) throw new Error("Failed to fetch companies");
  return response.json();
}

export async function fetchCompanyDetail(
  companyId: string | number,
): Promise<CompanyDetailResponse> {
  const response = await fetch(`/api/companies/${companyId}`, {
    credentials: "include",
  });
  if (!response.ok) throw new Error("Failed to fetch company");
  return response.json();
}
