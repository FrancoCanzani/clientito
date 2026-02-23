import { apiFetch } from "@/lib/api";
import type { Release } from "@releaselayer/shared";
import type { CreateReleaseInput, ReleaseResponse, UpdateReleaseInput } from "@/features/releases/release_types";

export function createRelease(projectId: string, data: CreateReleaseInput) {
  return apiFetch<{ data: Release }>(`/releases?projectId=${projectId}`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function fetchRelease(releaseId: string) {
  return apiFetch<ReleaseResponse>(`/releases/${releaseId}`);
}

export function publishRelease(releaseId: string) {
  return apiFetch(`/releases/${releaseId}/publish`, { method: "POST" });
}

export function updateRelease(releaseId: string, data: UpdateReleaseInput) {
  return apiFetch<{ data: Release }>(`/releases/${releaseId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function deleteRelease(releaseId: string) {
  return apiFetch<{ ok: boolean }>(`/releases/${releaseId}`, {
    method: "DELETE",
  });
}
