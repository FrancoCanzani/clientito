export type SyncStatus = {
  hasSynced: boolean;
  historyId: string | null;
  lastSync: number | null;
  phase: string | null;
  progressCurrent: number | null;
  progressTotal: number | null;
  error: string | null;
  needsGoogleReconnect: boolean;
  needsContactReview: boolean;
};

export async function fetchBriefing(): Promise<string> {
  const response = await fetch("/api/dashboard/briefing", {
    credentials: "include",
  });
  const json = await response.json();
  return json.data.text;
}

export async function fetchSyncStatus(): Promise<SyncStatus> {
  const response = await fetch("/api/sync/status", { credentials: "include" });
  if (!response.ok) {
    throw new Error("Failed to fetch sync status.");
  }
  const json = await response.json();
  return json.data;
}

export async function startFullSync(
  months?: number,
  continueFullSync?: boolean,
): Promise<void> {
  const response = await fetch("/api/sync/start", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ months, continueFullSync }),
  });

  if (response.status === 409) return;
  if (!response.ok) {
    throw new Error("Failed to start Gmail sync.");
  }
}

export async function runIncrementalSync(): Promise<void> {
  await fetch("/api/sync/incremental", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
}
