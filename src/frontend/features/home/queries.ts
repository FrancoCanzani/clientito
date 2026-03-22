export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

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

export type HomeBriefingItem = {
  id: string;
  type: "reply" | "fyi" | "overdue_task" | "due_today_task";
  title: string;
  reason: string;
  href: string;
};

export type HomeBriefing = {
  text: string;
  generatedAt: number;
  counts: {
    needsReply: number;
    dueToday: number;
    overdue: number;
  };
  items: HomeBriefingItem[];
};

export async function fetchBriefing(): Promise<HomeBriefing> {
  const response = await fetch("/api/ai/briefing");
  if (!response.ok) {
    throw new ApiError("Failed to fetch home briefing.", response.status);
  }
  const json = await response.json();
  return json.data;
}

export async function fetchSyncStatus(): Promise<SyncStatus> {
  const response = await fetch("/api/inbox/sync/status");
  if (!response.ok) {
    throw new ApiError("Failed to fetch sync status.", response.status);
  }
  const json = await response.json();
  return json.data;
}
