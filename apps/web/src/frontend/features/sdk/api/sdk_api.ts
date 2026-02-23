import { apiFetch } from "@/lib/api";
import type { SdkConfigResponse, SdkConfigRow, UpdateSdkConfigInput } from "@/features/sdk/sdk_types";

export function fetchSdkConfig(projectId: string) {
  return apiFetch<SdkConfigResponse>(`/sdk-config/${projectId}`);
}

export function updateSdkConfig(projectId: string, data: UpdateSdkConfigInput) {
  return apiFetch<{ data: SdkConfigRow }>(`/sdk-config/${projectId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}
