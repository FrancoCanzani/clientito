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

export type ReminderTask = {
  id: string;
  orgId: string;
  customerId: string;
  userId: string;
  message: string;
  dueAt: number;
  done: boolean;
  createdAt: number;
};

export async function fetchBriefing(orgId: string): Promise<string> {
  const response = await fetch(
    `/api/dashboard/briefing?orgId=${encodeURIComponent(orgId)}`,
    { credentials: "include" },
  );
  const json = await response.json();
  return json.data.text;
}

export async function fetchSyncStatus(orgId: string): Promise<SyncStatus> {
  const response = await fetch(
    `/api/sync/status?orgId=${encodeURIComponent(orgId)}`,
    { credentials: "include" },
  );
  const json = await response.json();
  return json.data;
}

export async function startFullSync(
  orgId: string,
  months?: number,
  continueFullSync?: boolean,
): Promise<void> {
  await fetch("/api/sync/start", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orgId, months, continueFullSync }),
  });
}

export async function runIncrementalSync(orgId: string): Promise<void> {
  await fetch("/api/sync/incremental", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orgId }),
  });
}

export async function fetchReminders(
  orgId: string,
  done: "true" | "false" | "all" = "false",
): Promise<ReminderTask[]> {
  const query = new URLSearchParams({ orgId, done });
  const response = await fetch(`/api/reminders?${query.toString()}`, {
    credentials: "include",
  });
  const json = await response.json();
  return json.data ?? [];
}
