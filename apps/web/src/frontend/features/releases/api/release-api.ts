import type {
  CreateReleaseInput,
  GithubConnection,
  GithubPullRequest,
  Release,
  ReleaseWithItems,
  UpdateReleaseInput,
} from "@/features/releases/types";
import { apiFetch } from "@/lib/api";

export async function fetchReleases(projectId: string): Promise<{ data: Release[] }> {
  const search = new URLSearchParams({ projectId });
  const response = await apiFetch(`/releases?${search.toString()}`);

  return response.json();
}

export async function fetchRelease(releaseId: string): Promise<{ data: ReleaseWithItems }> {
  const response = await apiFetch(`/releases/${releaseId}`);

  return response.json();
}

export async function createRelease(
  input: CreateReleaseInput,
): Promise<{ data: ReleaseWithItems | null }> {
  const response = await apiFetch("/releases", {
    method: "POST",
    body: JSON.stringify(input),
  });

  return response.json();
}

export async function updateRelease(
  releaseId: string,
  input: UpdateReleaseInput,
): Promise<{ data: ReleaseWithItems }> {
  const response = await apiFetch(`/releases/${releaseId}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });

  return response.json();
}

export async function deleteRelease(
  releaseId: string,
): Promise<{ success: boolean }> {
  const response = await apiFetch(`/releases/${releaseId}`, {
    method: "DELETE",
  });

  return response.json();
}

export async function generateNotes(
  releaseId: string,
): Promise<{ data: { notes: string } }> {
  const response = await apiFetch(`/releases/${releaseId}/generate-notes`, {
    method: "POST",
  });

  return response.json();
}

export async function fetchGithubConnection(
  projectId: string,
): Promise<{ data: GithubConnection | null }> {
  const search = new URLSearchParams({ projectId });
  const response = await apiFetch(`/github/connections?${search.toString()}`);

  return response.json();
}

export async function createGithubConnection(input: {
  projectId: string;
  repoOwner: string;
  repoName: string;
}): Promise<{ data: GithubConnection }> {
  const response = await apiFetch("/github/connections", {
    method: "POST",
    body: JSON.stringify(input),
  });

  return response.json();
}

export async function deleteGithubConnection(
  id: string,
): Promise<{ success: boolean }> {
  const response = await apiFetch(`/github/connections/${id}`, {
    method: "DELETE",
  });

  return response.json();
}

export async function fetchGithubPulls(
  projectId: string,
): Promise<{ data: GithubPullRequest[] }> {
  const search = new URLSearchParams({ projectId });
  const response = await apiFetch(`/github/pulls?${search.toString()}`);

  return response.json();
}
