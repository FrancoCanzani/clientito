/**
 * In-memory lock for provider message IDs with an in-flight user mutation.
 * While an ID is locked, incoming sync writes skip the mutable columns
 * (is_read, labels, etc.) so the user's optimistic state survives a server
 * sync that hasn't yet seen the mutation.
 */
const pending = new Set<string>();

export function markPending(providerMessageIds: string[]): void {
  for (const id of providerMessageIds) pending.add(id);
}

export function clearPending(providerMessageIds: string[]): void {
  for (const id of providerMessageIds) pending.delete(id);
}

export function pendingSubset(providerMessageIds: string[]): Set<string> {
  const hits = new Set<string>();
  for (const id of providerMessageIds) {
    if (pending.has(id)) hits.add(id);
  }
  return hits;
}
