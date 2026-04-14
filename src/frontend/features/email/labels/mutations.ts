import { queryClient } from "@/lib/query-client";
import { queryKeys } from "@/lib/query-keys";
import type { CreateLabelInput, Label, UpdateLabelInput } from "./types";

async function throwOnError(response: Response, fallback: string) {
  if (response.ok) return;
  const json = await response.json().catch(() => null);
  const msg = json && typeof json === "object" && "error" in json ? String(json.error) : fallback;
  throw new Error(msg);
}

export async function createLabel(mailboxId: number, input: CreateLabelInput): Promise<Label> {
  const response = await fetch("/api/inbox/labels", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mailboxId, ...input }),
  });
  await throwOnError(response, "Failed to create label");
  const result: { data: Label } = await response.json();
  queryClient.invalidateQueries({ queryKey: queryKeys.labels(mailboxId) });
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
  queryClient.invalidateQueries({ queryKey: queryKeys.labels(mailboxId) });
  return result.data;
}

export async function deleteLabel(labelId: string, mailboxId: number): Promise<void> {
  const response = await fetch(`/api/inbox/labels/${encodeURIComponent(labelId)}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mailboxId }),
  });
  await throwOnError(response, "Failed to delete label");
  queryClient.invalidateQueries({ queryKey: queryKeys.labels(mailboxId) });
}

export async function applyLabel(providerMessageIds: string[], labelId: string, mailboxId: number): Promise<void> {
  const response = await fetch("/api/inbox/labels/apply", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mailboxId,
      providerMessageIds,
      labelId,
    }),
  });
  await throwOnError(response, "Failed to apply label");
  queryClient.invalidateQueries({ queryKey: queryKeys.emails.all() });
}

export async function removeLabel(providerMessageIds: string[], labelId: string, mailboxId: number): Promise<void> {
  const response = await fetch("/api/inbox/labels/remove", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mailboxId,
      providerMessageIds,
      labelId,
    }),
  });
  await throwOnError(response, "Failed to remove label");
  queryClient.invalidateQueries({ queryKey: queryKeys.emails.all() });
}
