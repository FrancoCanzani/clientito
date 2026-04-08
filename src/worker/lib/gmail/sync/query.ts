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
