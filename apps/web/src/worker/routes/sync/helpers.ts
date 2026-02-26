export function monthsToGmailQuery(months?: number): string | undefined {
  if (!months) return undefined;

  const after = new Date();
  after.setMonth(after.getMonth() - months);
  const y = after.getFullYear();
  const m = String(after.getMonth() + 1).padStart(2, "0");
  const d = String(after.getDate()).padStart(2, "0");
  return `after:${y}/${m}/${d}`;
}
