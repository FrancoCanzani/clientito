import { apiFetch } from "@/lib/api";
import type {
  CreateOrganizationInput,
  CreateProjectInput,
  Organization,
  Project,
  WorkspaceItemResponse,
  WorkspaceListResponse,
} from "@/features/workspace/workspace-types";

export async function fetchOrganizations(): Promise<
  WorkspaceListResponse<Organization>
> {
  const response = await apiFetch("/orgs");
  return response.json();
}

export async function createOrganization(
  input: CreateOrganizationInput,
): Promise<WorkspaceItemResponse<Organization>> {
  const response = await apiFetch("/orgs", {
    method: "POST",
    body: JSON.stringify(input),
  });

  return response.json();
}

export async function fetchProjects(
  orgId: string,
): Promise<WorkspaceListResponse<Project>> {
  const search = new URLSearchParams({ orgId });
  const response = await apiFetch(`/projects?${search.toString()}`);

  return response.json();
}

export async function createProject(
  input: CreateProjectInput,
): Promise<WorkspaceItemResponse<Project>> {
  const response = await apiFetch("/projects", {
    method: "POST",
    body: JSON.stringify(input),
  });

  return response.json();
}
