import { localDb } from "@/db/client";
import { getCurrentUserId } from "@/db/user";
import type { Label } from "./types";

const labelSyncInFlight = new Map<number, Promise<Label[]>>();

async function syncLabelsOnce(mailboxId: number): Promise<Label[]> {
  const existing = labelSyncInFlight.get(mailboxId);
  if (existing) return existing;

  const task = syncLabelsFromServer(mailboxId).finally(() => {
    if (labelSyncInFlight.get(mailboxId) === task) {
      labelSyncInFlight.delete(mailboxId);
    }
  });
  labelSyncInFlight.set(mailboxId, task);
  return task;
}

export async function fetchLabels(mailboxId: number): Promise<Label[]> {
  const userId = await getCurrentUserId();
  if (!userId) return [];

  const localLabels = await localDb.getLabels(userId, mailboxId);
  if (localLabels.length > 0) return localLabels;

  try {
    return await syncLabelsOnce(mailboxId);
  } catch {
    return localLabels;
  }
}

export async function syncLabelsFromServer(mailboxId: number): Promise<Label[]> {
  const response = await fetch("/api/inbox/labels/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mailboxId }),
  });
  if (!response.ok) throw new Error("Failed to sync labels");
  const result: { data?: Label[] } = await response.json();
  const labels = result.data ?? [];

  const userId = await getCurrentUserId();
  if (userId) {
    // Remove local labels that no longer exist on the server
    const serverGmailIds = new Set(labels.map((l) => l.gmailId));
    const localLabels = await localDb.getLabels(userId, mailboxId);
    for (const local of localLabels) {
      if (!serverGmailIds.has(local.gmailId)) {
        await localDb.deleteLabel(local.gmailId);
      }
    }

    if (labels.length > 0) {
      await localDb.upsertLabels(userId, mailboxId, labels);
    }
  }

  return labels;
}
