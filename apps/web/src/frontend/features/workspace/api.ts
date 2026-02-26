import { apiFetch } from "@/lib/api";
import type {
  CreateOrganizationInput,
  Organization,
  UpdateOrganizationInput,
  WorkspaceItemResponse,
  WorkspaceListResponse,
} from "@/features/workspace/types";

type DataResponse<T> = { data: T };

export async function fetchOrganizations(): Promise<
  WorkspaceListResponse<Organization>
> {
  const response = await apiFetch("/orgs");
  return (await response.json()) as WorkspaceListResponse<Organization>;
}

export async function createOrganization(
  input: CreateOrganizationInput,
): Promise<WorkspaceItemResponse<Organization>> {
  const response = await apiFetch("/orgs", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return (await response.json()) as WorkspaceItemResponse<Organization>;
}

export async function updateOrganization(
  orgId: string,
  input: UpdateOrganizationInput,
): Promise<Organization> {
  const response = await apiFetch(`/orgs/${orgId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  const json = (await response.json()) as DataResponse<Organization>;
  return json.data;
}
