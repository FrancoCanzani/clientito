import { apiFetch } from "@/lib/api";
import type {
  CreateProjectInput,
  ProjectResponse,
  ProjectsResponse,
  ReleasesResponse,
  UsageSummaryResponse,
} from "@/features/projects/project_types";
import type { Project } from "@releaselayer/shared";

export function fetchProjects(orgId: string) {
  return apiFetch<ProjectsResponse>(`/projects?orgId=${orgId}`);
}

export function createProject(orgId: string, data: CreateProjectInput) {
  return apiFetch<{ data: Project }>(`/projects?orgId=${orgId}`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function fetchProject(projectId: string) {
  return apiFetch<ProjectResponse>(`/projects/${projectId}`);
}

export function fetchProjectReleases(projectId: string) {
  return apiFetch<ReleasesResponse>(`/releases?projectId=${projectId}`);
}

export function fetchUsageSummary(projectId: string) {
  return apiFetch<UsageSummaryResponse>(`/usage/summary?projectId=${projectId}`);
}
