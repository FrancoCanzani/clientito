export type SyncPreference = {
  mailboxId: number | null;
  months: 6 | 12 | null;
  cutoffAt: number | null;
};

export type UpdateSyncPreferenceResult = SyncPreference & {
  requiresBackfill: boolean;
};

export type UpdateSyncPreferenceInput = {
  mailboxId: number;
  months: 6 | 12 | null;
};

export async function updateSyncPreference(
  input: UpdateSyncPreferenceInput,
): Promise<UpdateSyncPreferenceResult> {
  const response = await fetch("/api/settings/sync", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const json = await response.json().catch(() => ({}));
    throw new Error(
      (json as { error?: string }).error ?? "Failed to update import history",
    );
  }

  const json = await response.json();
  return json.data;
}

export async function updateMailboxSignature(
  mailboxId: number,
  signature: string,
): Promise<void> {
  const response = await fetch(`/api/settings/mailboxes/${mailboxId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ signature }),
  });

  if (!response.ok) {
    const json = await response.json().catch(() => ({}));
    throw new Error(
      (json as { error?: string }).error ?? "Failed to update signature",
    );
  }
}

export async function deleteAccount(): Promise<void> {
  const response = await fetch("/api/settings/account", {
    method: "DELETE",
  });

  if (!response.ok) {
    const json = await response.json().catch(() => ({}));
    throw new Error(
      (json as { error?: string }).error ?? "Failed to delete account",
    );
  }
}
