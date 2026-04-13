import { localDb } from "@/db/client";
import { getCurrentUserId } from "@/db/user";
import type { Label } from "./types";

export async function fetchLabels(mailboxId: number): Promise<Label[]> {
  const userId = await getCurrentUserId();
  if (!userId) return [];
  return localDb.getLabels(userId, mailboxId);
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
  if (userId && labels.length > 0) {
    await localDb.upsertLabels(userId, mailboxId, labels);
  }

  return labels;
}
