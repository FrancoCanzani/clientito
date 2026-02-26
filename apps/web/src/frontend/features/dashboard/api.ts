import { apiFetch } from "@/lib/api";

export type SyncStatus = {
  hasSynced: boolean;
  historyId: string | null;
  lastSync: number | null;
  phase: string | null;
  progressCurrent: number | null;
  progressTotal: number | null;
  error: string | null;
  needsContactReview: boolean;
};

type DataResponse<T> = { data: T };

export async function fetchSyncStatus(orgId: string): Promise<SyncStatus> {
  const response = await apiFetch(`/sync/status?orgId=${encodeURIComponent(orgId)}`);
  const json = (await response.json()) as DataResponse<SyncStatus>;
  return json.data;
}

export async function startFullSync(orgId: string, months?: number): Promise<void> {
  await apiFetch("/sync/start", {
    method: "POST",
    body: JSON.stringify({ orgId, months }),
  });
}

export async function runIncrementalSync(orgId: string): Promise<void> {
  await apiFetch("/sync/incremental", {
    method: "POST",
    body: JSON.stringify({ orgId }),
  });
}
