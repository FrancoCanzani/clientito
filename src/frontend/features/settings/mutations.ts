export type SyncPreference = {
  months: 6 | 12 | null;
  cutoffAt: number | null;
};

export type UpdateSyncPreferenceResult = SyncPreference & {
  requiresBackfill: boolean;
};

export async function updateSyncPreference(
  months: 6 | 12 | null,
): Promise<UpdateSyncPreferenceResult> {
  const response = await fetch("/api/settings/sync", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ months }),
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
