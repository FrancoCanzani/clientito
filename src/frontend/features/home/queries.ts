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
  type:
    | "email_action"
    | "briefing_email"
    | "overdue_task"
    | "due_today_task"
    | "calendar_suggestion"
    | "calendar_event";
  title: string;
  reason: string;
  href: string;
  emailId?: number;
  actionId?: string;
  actionType?: string;
  draftReply?: string | null;
  threadId?: string | null;
  fromAddr?: string;
  subject?: string | null;
  mailboxId?: number | null;
  messageId?: string | null;
  proposedEventId?: number;
  eventStart?: number;
  eventEnd?: number;
  eventLocation?: string | null;
  eventDescription?: string | null;
};

export type HomeBriefing = {
  text: string;
  generatedAt: number;
  counts: {
    actionNeeded: number;
    dueToday: number;
    overdue: number;
  };
  items: HomeBriefingItem[];
};

export async function fetchBriefing(): Promise<HomeBriefing> {
  const response = await fetch("/api/ai/briefing");
  if (!response.ok) throw { status: response.status };
  const json = await response.json();
  return json.data;
}

export async function postBriefingDecision(body: {
  itemType: "email_action" | "task" | "calendar_suggestion";
  referenceId: number;
  decision: "dismissed" | "replied" | "archived" | "approved";
  actionId?: string;
}): Promise<void> {
  const response = await fetch("/api/ai/briefing/decision", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw { status: response.status };
}

export async function fetchSyncStatus(): Promise<SyncStatus> {
  const response = await fetch("/api/inbox/sync/status");
  if (!response.ok) throw { status: response.status };
  const json = await response.json();
  return json.data;
}
