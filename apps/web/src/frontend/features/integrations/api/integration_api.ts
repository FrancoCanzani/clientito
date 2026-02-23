import { apiFetch } from "@/lib/api";
import type { Integration } from "@releaselayer/shared";
import type {
  CreateIntegrationInput,
  IntegrationsResponse,
  UpdateIntegrationInput,
} from "@/features/integrations/integration_types";

export function fetchIntegrations(projectId: string) {
  return apiFetch<IntegrationsResponse>(`/integrations?projectId=${projectId}`);
}

export function createIntegration(projectId: string, data: CreateIntegrationInput) {
  return apiFetch<{ data: Integration }>(`/integrations?projectId=${projectId}`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateIntegration(integrationId: string, data: UpdateIntegrationInput) {
  return apiFetch<{ data: Integration }>(`/integrations/${integrationId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function toggleIntegration(integrationId: string) {
  return apiFetch<{ data: Integration }>(`/integrations/${integrationId}/toggle`, {
    method: "POST",
  });
}

export function deleteIntegration(integrationId: string) {
  return apiFetch<{ ok: boolean }>(`/integrations/${integrationId}`, {
    method: "DELETE",
  });
}
