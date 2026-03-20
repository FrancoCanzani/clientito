export type SyncWindowMonths = 6 | 12;

export function normalizeSyncWindowMonths(
  months: number | null | undefined,
): SyncWindowMonths | null {
  if (months === 6 || months === 12) return months;
  return null;
}

export function resolveSyncCutoffAt(
  months: number | null | undefined,
  now = new Date(),
): number | null {
  const normalized = normalizeSyncWindowMonths(months);
  if (normalized === null) return null;

  const cutoff = new Date(now);
  cutoff.setMonth(cutoff.getMonth() - normalized);
  return cutoff.getTime();
}

export function buildGmailQueryFromCutoff(
  cutoffAt: number | null | undefined,
): string | undefined {
  if (typeof cutoffAt !== "number" || !Number.isFinite(cutoffAt)) {
    return undefined;
  }

  const after = new Date(cutoffAt);
  const y = after.getFullYear();
  const m = String(after.getMonth() + 1).padStart(2, "0");
  const d = String(after.getDate()).padStart(2, "0");
  return `after:${y}/${m}/${d}`;
}

export function requiresBackfillForCutoffChange(
  previousCutoffAt: number | null | undefined,
  nextCutoffAt: number | null | undefined,
): boolean {
  if (previousCutoffAt == null) return false;
  if (nextCutoffAt == null) return true;
  return nextCutoffAt < previousCutoffAt;
}
