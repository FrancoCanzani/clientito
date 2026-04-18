/**
 * In-memory lock for provider message IDs with an in-flight user mutation.
 * While an ID is locked, incoming sync writes skip mutable columns
 * (is_read, labels, snoozed_until), so optimistic state is not overwritten
 * by stale server snapshots.
 */
const pendingCounts = new Map<string, number>();

export function markPending(providerMessageIds: string[]): void {
  for (const id of providerMessageIds) {
    const current = pendingCounts.get(id) ?? 0;
    pendingCounts.set(id, current + 1);
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
