export type SyncWindowMonths = 3 | 6 | 12;

export const DEFAULT_SYNC_WINDOW_MONTHS: SyncWindowMonths = 3;

export function normalizeSyncWindowMonths(
  months: number | null | undefined,
): SyncWindowMonths | null {
  if (months === 3 || months === 6 || months === 12) return months;
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
