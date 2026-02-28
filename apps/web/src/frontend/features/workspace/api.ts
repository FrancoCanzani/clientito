import type {
  CreateOrganizationInput,
  Organization,
  UpdateOrganizationInput,
  WorkspaceItemResponse,
  WorkspaceListResponse,
} from "@/features/workspace/types";

export async function fetchOrganizations(): Promise<
  WorkspaceListResponse<Organization>
> {
  const response = await fetch("/api/orgs", { credentials: "include" });
  return response.json();
}

export async function createOrganization(
  input: CreateOrganizationInput,
): Promise<WorkspaceItemResponse<Organization>> {
  const response = await fetch("/api/orgs", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return response.json();
}

export async function updateOrganization(
  orgId: string,
  input: UpdateOrganizationInput,
): Promise<Organization> {
  const response = await fetch(`/api/orgs/${orgId}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const json = await response.json();
  return json.data;
}
