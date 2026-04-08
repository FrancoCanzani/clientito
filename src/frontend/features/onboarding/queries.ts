export type SyncStatus = {
  state:
    | "needs_mailbox_connect"
    | "needs_reconnect"
    | "ready_to_sync"
    | "error"
    | "syncing"
    | "ready";
  hasSynced: boolean;
  historyId: string | null;
  lastSync: number | null;
  phase: string | null;
  progressCurrent: number | null;
  progressTotal: number | null;
  error: string | null;
  needsMailboxConnect: boolean;
  needsGoogleReconnect: boolean;
};

export async function fetchSyncStatus(): Promise<SyncStatus> {
  const response = await fetch("/api/inbox/sync/status");
  if (!response.ok) throw { status: response.status };
  const json: SyncStatus = await response.json();
  return json;
}
