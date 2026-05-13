// Tracks which providerMessageIds are currently being mutated by the user so
// background sync does not overwrite their mutable columns mid-flight.
const pendingCounts = new Map<string, number>();

export function markPending(providerMessageIds: string[]): void {
  for (const id of providerMessageIds) {
    pendingCounts.set(id, (pendingCounts.get(id) ?? 0) + 1);
  }
}

export function clearPending(providerMessageIds: string[]): void {
  for (const id of providerMessageIds) {
    const current = pendingCounts.get(id);
    if (!current) continue;
    if (current <= 1) pendingCounts.delete(id);
    else pendingCounts.set(id, current - 1);
  }
}

export function pendingSubset(providerMessageIds: string[]): Set<string> {
  const hits = new Set<string>();
  for (const id of providerMessageIds) {
    if ((pendingCounts.get(id) ?? 0) > 0) hits.add(id);
  }
  return hits;
}
