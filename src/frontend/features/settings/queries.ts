import type { SyncPreference } from "./mutations";

export async function fetchSyncPreference(): Promise<SyncPreference> {
  const response = await fetch("/api/settings/sync");
  if (!response.ok) {
    throw new Error("Failed to fetch import history");
  }

  const json = await response.json();
  return json.data;
}
