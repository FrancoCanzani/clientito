import { labelQueryKeys } from "@/features/email/labels/query-keys";
import { localDb } from "@/db/client";
import { invalidateInboxQueries } from "@/features/email/mail/queries";
import { applyLabelToCaches } from "@/features/email/mail/utils/optimistic-mail-state";
import { queryClient } from "@/lib/query-client";
import { syncLabelsFromServer } from "./queries";
import type { CreateLabelInput, Label, UpdateLabelInput } from "./types";

async function throwOnError(response: Response, fallback: string) {
  if (response.ok) return;
  const json = await response.json().catch(() => null);
  const msg = json && typeof json === "object" && "error" in json ? String(json.error) : fallback;
  throw new Error(msg);
}

async function refreshLabels(mailboxId: number) {
  await syncLabelsFromServer(mailboxId);
  await queryClient.invalidateQueries({ queryKey: labelQueryKeys.list(mailboxId) });
}

export async function createLabel(mailboxId: number, input: CreateLabelInput): Promise<Label> {
  const response = await fetch("/api/inbox/labels", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mailboxId, ...input }),
  });
  await throwOnError(response, "Failed to create label");
  const result: { data: Label } = await response.json();
  await refreshLabels(mailboxId);
  return result.data;
}

export async function updateLabel(
  labelId: string,
  mailboxId: number,
  input: UpdateLabelInput,
): Promise<Label> {
  const response = await fetch(`/api/inbox/labels/${encodeURIComponent(labelId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mailboxId, ...input }),
  });
  await throwOnError(response, "Failed to update label");
  const result: { data: Label } = await response.json();
  await refreshLabels(mailboxId);
  return result.data;
}

export async function deleteLabel(labelId: string, mailboxId: number): Promise<void> {
  const response = await fetch(
    `/api/inbox/labels/${encodeURIComponent(labelId)}?mailboxId=${mailboxId}`,
    { method: "DELETE" },
  );
  await throwOnError(response, "Failed to delete label");
  await refreshLabels(mailboxId);
}

export async function applyLabel(providerMessageIds: string[], labelId: string, mailboxId: number): Promise<void> {
  applyLabelToCaches(queryClient, providerMessageIds, labelId, true);
  await localDb.addLabelToEmails(providerMessageIds, labelId);

  const response = await fetch("/api/inbox/labels/apply", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mailboxId,
      providerMessageIds,
      labelId,
    }),
  });
  if (!response.ok) {
    // Rollback local change
    applyLabelToCaches(queryClient, providerMessageIds, labelId, false);
    await localDb.removeLabelFromEmails(providerMessageIds, labelId);
    invalidateInboxQueries();
    await throwOnError(response, "Failed to apply label");
  }
  invalidateInboxQueries();
}

export async function removeLabel(providerMessageIds: string[], labelId: string, mailboxId: number): Promise<void> {
  applyLabelToCaches(queryClient, providerMessageIds, labelId, false);
  await localDb.removeLabelFromEmails(providerMessageIds, labelId);

  const response = await fetch("/api/inbox/labels/remove", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mailboxId,
      providerMessageIds,
      labelId,
    }),
  });
  if (!response.ok) {
    // Rollback local change
    applyLabelToCaches(queryClient, providerMessageIds, labelId, true);
    await localDb.addLabelToEmails(providerMessageIds, labelId);
    invalidateInboxQueries();
    await throwOnError(response, "Failed to remove label");
  }
  invalidateInboxQueries();
}
